import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';
import { INVALID_ARRAY, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class DeleteProductsDto {
  @ApiProperty({ type: [String], example: ['product-uuid-1', 'product-uuid-2'] })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @IsString({ each: true, message: INVALID_STRING })
  productIds!: string[];
}
