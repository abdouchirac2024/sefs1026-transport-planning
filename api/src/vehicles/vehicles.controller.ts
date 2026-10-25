import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiUserHeader } from '../common/swagger/api-user-header.decorator';
import { VehicleDto } from './dto/vehicle.dto';
import { VehiclesRepository } from './vehicles.repository';

@ApiTags('vehicles')
@ApiUserHeader()
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesRepository) {}

  @Get()
  @ApiOperation({ summary: 'Liste des véhicules actifs (Active = 1).' })
  findActive(): Promise<VehicleDto[]> {
    return this.vehicles.findActive();
  }
}
