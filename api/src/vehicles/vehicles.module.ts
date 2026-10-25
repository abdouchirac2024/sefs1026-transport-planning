import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesRepository } from './vehicles.repository';

@Module({
  controllers: [VehiclesController],
  providers: [VehiclesRepository],
  exports: [VehiclesRepository],
})
export class VehiclesModule {}
