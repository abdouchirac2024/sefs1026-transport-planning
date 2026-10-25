import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/pagination';

export class ToPlanQueryDto extends PageQueryDto {
  @ApiPropertyOptional({
    example: 'Douala',
    description: 'Filtre exact sur la ville de livraison.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  city?: string;
}
