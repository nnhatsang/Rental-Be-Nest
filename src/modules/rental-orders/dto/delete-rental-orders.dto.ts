import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';
import { INVALID_ARRAY, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class DeleteRentalOrdersDto {
  @ApiProperty({ type: [String], example: ['order-uuid-1', 'order-uuid-2'] })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @IsString({ each: true, message: INVALID_STRING })
  rentalOrderIds!: string[];
}
