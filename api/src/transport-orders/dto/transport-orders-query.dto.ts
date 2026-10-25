import { Type } from 'class-transformer';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { PageQueryDto } from '../../common/pagination';

export class TransportOrdersQueryDto extends PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1, 2], {
    message: 'status doit être 0 (Brouillon), 1 (Validé) ou 2 (Parti).',
  })
  status?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date doit être au format YYYY-MM-DD.',
  })
  date?: string;
}
