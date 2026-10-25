import { Controller, Get } from '@nestjs/common';
import { VehicleDto } from './dto/vehicle.dto';
import { VehiclesRepository } from './vehicles.repository';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesRepository) {}

  @Get()
  findActive(): Promise<VehicleDto[]> {
    return this.vehicles.findActive();
  }
}
