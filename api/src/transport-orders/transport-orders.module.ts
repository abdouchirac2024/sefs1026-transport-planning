import { Module } from '@nestjs/common';
import { SalesOrdersModule } from '../sales-orders/sales-orders.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { TransportOrdersController } from './transport-orders.controller';
import { TransportOrdersRepository } from './transport-orders.repository';
import { TransportOrdersService } from './transport-orders.service';

@Module({
  imports: [VehiclesModule, SalesOrdersModule],
  controllers: [TransportOrdersController],
  providers: [TransportOrdersRepository, TransportOrdersService],
  exports: [TransportOrdersRepository],
})
export class TransportOrdersModule {}
