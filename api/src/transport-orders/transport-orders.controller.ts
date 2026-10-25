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
import { CurrentUser } from '../auth/current-user.decorator';
import { Role } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { User } from '../auth/users';
import { DomainError } from '../common/errors/domain-error';
import { ErrorCode } from '../common/errors/error-codes';
import { Page } from '../common/pagination';
import { AddLinesDto } from './dto/add-lines.dto';
import { CreateTransportOrderDto } from './dto/create-transport-order.dto';
import { TransportOrderDetailDto } from './dto/transport-order-detail.dto';
import { TransportOrderListItemDto } from './dto/transport-order-list-item.dto';
import { TransportOrdersQueryDto } from './dto/transport-orders-query.dto';
import { TransportOrdersRepository } from './transport-orders.repository';
import { TransportOrdersService } from './transport-orders.service';

@Controller('transport-orders')
export class TransportOrdersController {
  constructor(
    private readonly transportOrders: TransportOrdersRepository,
    private readonly transportOrdersService: TransportOrdersService,
  ) {}

  @Get()
  findAll(
    @Query() query: TransportOrdersQueryDto,
  ): Promise<Page<TransportOrderListItemDto>> {
    return this.transportOrders.findAll(query);
  }

  @Get(':no')
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
  create(
    @Body() body: CreateTransportOrderDto,
    @CurrentUser() user: User,
  ): Promise<TransportOrderDetailDto> {
    return this.transportOrdersService.create(body, user);
  }

  @Post(':no/lines')
  @Roles(Role.DISPATCHER, Role.LOGISTICS_MANAGER)
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
  removeLine(
    @Param('no') no: string,
    @Param('salesOrderNo') salesOrderNo: string,
    @Headers('if-match') ifMatch?: string,
  ): Promise<TransportOrderDetailDto> {
    return this.transportOrdersService.removeLine(no, salesOrderNo, ifMatch);
  }

  @Post(':no/validate')
  @Roles(Role.LOGISTICS_MANAGER)
  validate(
    @Param('no') no: string,
    @CurrentUser() user: User,
    @Headers('if-match') ifMatch?: string,
  ): Promise<TransportOrderDetailDto> {
    return this.transportOrdersService.validate(no, user, ifMatch);
  }

  @Post(':no/depart')
  @Roles(Role.DISPATCHER, Role.LOGISTICS_MANAGER)
  depart(
    @Param('no') no: string,
    @Headers('if-match') ifMatch?: string,
  ): Promise<TransportOrderDetailDto> {
    return this.transportOrdersService.depart(no, ifMatch);
  }
}
