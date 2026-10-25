import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator';
import { ApiUserHeader } from '../common/swagger/api-user-header.decorator';
import { Page } from '../common/pagination';
import { SalesOrderToPlanDto } from './dto/sales-order-to-plan.dto';
import { ToPlanQueryDto } from './dto/to-plan-query.dto';
import { SalesOrdersRepository } from './sales-orders.repository';

@ApiTags('sales-orders')
@ApiUserHeader()
@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private readonly salesOrders: SalesOrdersRepository) {}

  @Get('to-plan')
  @ApiOperation({
    summary:
      'Commandes au statut "À planifier" (0), filtrables par ville exacte, paginées.',
  })
  @ApiErrorResponse(
    400,
    'VALIDATION_ERROR',
    'page doit être un entier >= 1 (ou pageSize entre 1 et 100).',
  )
  findToPlan(
    @Query() query: ToPlanQueryDto,
  ): Promise<Page<SalesOrderToPlanDto>> {
    return this.salesOrders.findToPlan(query);
  }

  @Get('cities')
  @ApiOperation({
    summary:
      'Villes distinctes parmi les commandes "À planifier" (pour le filtre front).',
  })
  findCities(): Promise<string[]> {
    return this.salesOrders.findCities();
  }
}
