import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateTransportOrderDto {
  @IsString()
  @IsNotEmpty()
  vehicleCode: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'deliveryDate doit être au format YYYY-MM-DD.',
  })
  deliveryDate: string;
}
