import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AddLinesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  salesOrderNos: string[];
}
