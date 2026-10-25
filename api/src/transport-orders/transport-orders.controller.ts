import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { Page } from '../common/pagination';
import { DomainError } from '../common/errors/domain-error';
import { ErrorCode } from '../common/errors/error-codes';
import { TransportOrderDetailDto } from './dto/transport-order-detail.dto';
import { TransportOrderListItemDto } from './dto/transport-order-list-item.dto';
import { TransportOrdersQueryDto } from './dto/transport-orders-query.dto';
import { TransportOrdersRepository } from './transport-orders.repository';

@Controller('transport-orders')
export class TransportOrdersController {
  constructor(private readonly transportOrders: TransportOrdersRepository) {}

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
}
