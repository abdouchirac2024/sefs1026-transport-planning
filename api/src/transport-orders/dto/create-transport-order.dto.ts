import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateTransportOrderDto {
  @ApiProperty({ example: 'VH-01' })
  @IsString()
  @IsNotEmpty()
  vehicleCode: string;

  @ApiProperty({
    example: '2026-01-15',
    description: 'Format YYYY-MM-DD, non dans le passé.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'deliveryDate doit être au format YYYY-MM-DD.',
  })
  deliveryDate: string;
}
