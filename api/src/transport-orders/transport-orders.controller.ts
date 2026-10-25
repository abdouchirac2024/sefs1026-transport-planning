import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { User } from '../auth/users';
import { DomainError } from '../common/errors/domain-error';
import { ErrorCode } from '../common/errors/error-codes';
import { Page } from '../common/pagination';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator';
import { ApiUserHeader } from '../common/swagger/api-user-header.decorator';
import { AddLinesDto } from './dto/add-lines.dto';
import { CreateTransportOrderDto } from './dto/create-transport-order.dto';
import { TransportOrderDetailDto } from './dto/transport-order-detail.dto';
import { TransportOrderListItemDto } from './dto/transport-order-list-item.dto';
import { TransportOrdersQueryDto } from './dto/transport-orders-query.dto';
import { TransportOrdersRepository } from './transport-orders.repository';
import { TransportOrdersService } from './transport-orders.service';

/** Documente l'en-tête optionnel de concurrence optimiste, commun aux mutations après création. */
const IF_MATCH_HEADER = ApiHeader({
  name: 'If-Match',
  description:
    'Version lue précédemment (champ `version`), pour un contrôle de concurrence optimiste. Optionnel.',
  required: false,
});

@ApiTags('transport-orders')
@ApiUserHeader()
@Controller('transport-orders')
export class TransportOrdersController {
  constructor(
    private readonly transportOrders: TransportOrdersRepository,
    private readonly transportOrdersService: TransportOrdersService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste paginée des ordres, filtrable par statut et par date.',
  })
  @ApiErrorResponse(
    400,
    'VALIDATION_ERROR',
    'status doit être 0, 1 ou 2 ; date doit être au format YYYY-MM-DD.',
  )
  findAll(
    @Query() query: TransportOrdersQueryDto,
  ): Promise<Page<TransportOrderListItemDto>> {
    return this.transportOrders.findAll(query);
  }

  @Get(':no')
  @ApiOperation({
    summary:
      "Détail d'un ordre : véhicule, lignes, poids total, capacité restante.",
  })
  @ApiParam({ name: 'no', example: 'TO-0003' })
  @ApiErrorResponse(
    404,
    'TRANSPORT_ORDER_NOT_FOUND',
    'Ordre de transport introuvable : TO-9999.',
  )
  async findOne(@Param('no') no: string): Promise<TransportOrderDetailDto> {
    const order = await this.transportOrders.findDetail(no);
    if (!order) {
      throw new DomainError(
        ErrorCode.TRANSPORT_ORDER_NOT_FOUND,
        `Ordre de transport introuvable : ${no}.`,
        HttpStatus.NOT_FOUND,
      );
    }
    return order;
  }

  @Post()
  @Roles(Role.DISPATCHER, Role.LOGISTICS_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Crée un ordre au statut Brouillon pour un véhicule actif et une date non passée.',
  })
  @ApiErrorResponse(404, 'VEHICLE_NOT_FOUND', 'Véhicule introuvable.')
  @ApiErrorResponse(
    409,
    'VEHICLE_ALREADY_BOOKED',
    'Ce véhicule a déjà un ordre de transport pour cette date.',
  )
  @ApiErrorResponse(422, 'VEHICLE_INACTIVE', 'Le véhicule est hors service.')
  @ApiErrorResponse(
    422,
    'DELIVERY_DATE_IN_PAST',
    'La date de livraison ne peut pas être dans le passé.',
  )
  create(
    @Body() body: CreateTransportOrderDto,
    @CurrentUser() user: User,
  ): Promise<TransportOrderDetailDto> {
    return this.transportOrdersService.create(body, user);
  }

  @Post(':no/lines')
  @Roles(Role.DISPATCHER, Role.LOGISTICS_MANAGER)
  @IF_MATCH_HEADER
  @ApiOperation({
    summary: "Ajoute une ou plusieurs commandes à l'ordre (tout ou rien).",
  })
  @ApiParam({ name: 'no', example: 'TO-0003' })
  @ApiErrorResponse(
    404,
    'TRANSPORT_ORDER_NOT_FOUND',
    'Ordre de transport introuvable : TO-9999.',
  )
  @ApiErrorResponse(
    404,
    'SALES_ORDER_NOT_FOUND',
    'Commande(s) introuvable(s) : SO-9999.',
  )
  @ApiErrorResponse(
    409,
    'ORDER_NOT_EDITABLE',
    "L'ordre n'est plus modifiable (il n'est plus au statut Brouillon).",
  )
  @ApiErrorResponse(
    409,
    'SALES_ORDER_NOT_PLANNABLE',
    'Commande(s) non planifiable(s) (déjà affectée(s) à un ordre ou en livraison) : SO-1003.',
  )
  @ApiErrorResponse(
    422,
    'CAPACITY_EXCEEDED',
    'Le poids total (1 520,00 kg) dépasse la capacité du véhicule (1 500,00 kg).',
    { capacityKg: 1500, currentKg: 1360, addedKg: 160 },
  )
  @ApiErrorResponse(
    412,
    'STALE_VERSION',
    "La version de l'ordre a changé depuis sa dernière lecture, veuillez recharger les données.",
  )
  addLines(
    @Param('no') no: string,
    @Body() body: AddLinesDto,
    @Headers('if-match') ifMatch?: string,
  ): Promise<TransportOrderDetailDto> {
    return this.transportOrdersService.addLines(
      no,
      body.salesOrderNos,
      ifMatch,
    );
  }

  @Delete(':no/lines/:salesOrderNo')
  @Roles(Role.DISPATCHER, Role.LOGISTICS_MANAGER)
  @IF_MATCH_HEADER
  @ApiOperation({ summary: "Retire une commande de l'ordre." })
  @ApiParam({ name: 'no', example: 'TO-0003' })
  @ApiParam({ name: 'salesOrderNo', example: 'SO-1006' })
  @ApiErrorResponse(
    404,
    'TRANSPORT_ORDER_NOT_FOUND',
    'Ordre de transport introuvable : TO-9999.',
  )
  @ApiErrorResponse(
    404,
    'TRANSPORT_ORDER_LINE_NOT_FOUND',
    "La commande SO-9999 ne fait pas partie de l'ordre TO-0003.",
  )
  @ApiErrorResponse(
    409,
    'ORDER_NOT_EDITABLE',
    "L'ordre n'est plus modifiable (il n'est plus au statut Brouillon).",
  )
  @ApiErrorResponse(
    412,
    'STALE_VERSION',
    "La version de l'ordre a changé depuis sa dernière lecture, veuillez recharger les données.",
  )
  removeLine(
    @Param('no') no: string,
    @Param('salesOrderNo') salesOrderNo: string,
    @Headers('if-match') ifMatch?: string,
  ): Promise<TransportOrderDetailDto> {
    return this.transportOrdersService.removeLine(no, salesOrderNo, ifMatch);
  }

  @Post(':no/validate')
  @Roles(Role.LOGISTICS_MANAGER)
  @IF_MATCH_HEADER
  @ApiOperation({
    summary:
      'Valide un ordre (réservé à LOGISTICS_MANAGER). Non modifiable ensuite.',
  })
  @ApiParam({ name: 'no', example: 'TO-0003' })
  @ApiErrorResponse(
    403,
    'FORBIDDEN_ROLE',
    'Seul un LOGISTICS_MANAGER peut valider un ordre de transport.',
  )
  @ApiErrorResponse(
    404,
    'TRANSPORT_ORDER_NOT_FOUND',
    'Ordre de transport introuvable : TO-9999.',
  )
  @ApiErrorResponse(
    409,
    'INVALID_STATUS_TRANSITION',
    'Seul un ordre au statut Brouillon peut être validé.',
  )
  @ApiErrorResponse(
    422,
    'EMPTY_ORDER',
    'Un ordre sans commande ne peut pas être validé.',
  )
  @ApiErrorResponse(
    412,
    'STALE_VERSION',
    "La version de l'ordre a changé depuis sa dernière lecture, veuillez recharger les données.",
  )
  validate(
    @Param('no') no: string,
    @CurrentUser() user: User,
    @Headers('if-match') ifMatch?: string,
  ): Promise<TransportOrderDetailDto> {
    return this.transportOrdersService.validate(no, user, ifMatch);
  }

  @Post(':no/depart')
  @Roles(Role.DISPATCHER, Role.LOGISTICS_MANAGER)
  @IF_MATCH_HEADER
  @ApiOperation({
    summary:
      'Marque un ordre Validé comme Parti ; ses commandes passent En livraison.',
  })
  @ApiParam({ name: 'no', example: 'TO-0002' })
  @ApiErrorResponse(
    404,
    'TRANSPORT_ORDER_NOT_FOUND',
    'Ordre de transport introuvable : TO-9999.',
  )
  @ApiErrorResponse(
    409,
    'INVALID_STATUS_TRANSITION',
    'Seul un ordre Validé peut être marqué Parti.',
  )
  @ApiErrorResponse(
    412,
    'STALE_VERSION',
    "La version de l'ordre a changé depuis sa dernière lecture, veuillez recharger les données.",
  )
  depart(
    @Param('no') no: string,
    @Headers('if-match') ifMatch?: string,
  ): Promise<TransportOrderDetailDto> {
    return this.transportOrdersService.depart(no, ifMatch);
  }
}
