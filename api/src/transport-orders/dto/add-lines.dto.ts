import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AddLinesDto {
  @ApiProperty({ example: ['SO-1027', 'SO-1040'], type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  salesOrderNos: string[];
}
