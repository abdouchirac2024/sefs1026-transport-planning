import { Module } from '@nestjs/common';
import { SalesOrdersController } from './sales-orders.controller';
import { SalesOrdersRepository } from './sales-orders.repository';

@Module({
  controllers: [SalesOrdersController],
  providers: [SalesOrdersRepository],
  exports: [SalesOrdersRepository],
})
export class SalesOrdersModule {}
