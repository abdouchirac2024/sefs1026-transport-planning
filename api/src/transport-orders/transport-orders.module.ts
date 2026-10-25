import { Module } from '@nestjs/common';
import { TransportOrdersController } from './transport-orders.controller';
import { TransportOrdersRepository } from './transport-orders.repository';

@Module({
  controllers: [TransportOrdersController],
  providers: [TransportOrdersRepository],
  exports: [TransportOrdersRepository],
})
export class TransportOrdersModule {}
