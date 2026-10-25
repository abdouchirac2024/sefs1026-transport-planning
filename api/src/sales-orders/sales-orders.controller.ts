import { Controller, Get, Query } from '@nestjs/common';
import { Page } from '../common/pagination';
import { SalesOrderToPlanDto } from './dto/sales-order-to-plan.dto';
import { ToPlanQueryDto } from './dto/to-plan-query.dto';
import { SalesOrdersRepository } from './sales-orders.repository';

@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private readonly salesOrders: SalesOrdersRepository) {}

  @Get('to-plan')
  findToPlan(
    @Query() query: ToPlanQueryDto,
  ): Promise<Page<SalesOrderToPlanDto>> {
    return this.salesOrders.findToPlan(query);
  }

  @Get('cities')
  findCities(): Promise<string[]> {
    return this.salesOrders.findCities();
  }
}
