import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/pagination';

export class ToPlanQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  city?: string;
}
