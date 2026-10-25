import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { PageQueryDto } from '../../common/pagination';

export class TransportOrdersQueryDto extends PageQueryDto {
  @ApiPropertyOptional({
    enum: [0, 1, 2],
    description: '0 = Brouillon, 1 = Validé, 2 = Parti.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1, 2], {
    message: 'status doit être 0 (Brouillon), 1 (Validé) ou 2 (Parti).',
  })
  status?: number;

  @ApiPropertyOptional({
    example: '2026-01-15',
    description: 'Format YYYY-MM-DD.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date doit être au format YYYY-MM-DD.',
  })
  date?: string;
}
