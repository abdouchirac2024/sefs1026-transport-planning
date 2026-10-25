import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import databaseConfig from './config/database.config';
import { DatabaseModule } from './database/database.module';
import { SalesOrdersModule } from './sales-orders/sales-orders.module';
import { TransportOrdersModule } from './transport-orders/transport-orders.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    DatabaseModule,
    AuthModule,
    VehiclesModule,
    SalesOrdersModule,
    TransportOrdersModule,
  ],
})
export class AppModule {}
