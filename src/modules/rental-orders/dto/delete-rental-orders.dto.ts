import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { INVALID_ARRAY, INVALID_UUID } from '@/libs/constants/invalid.constant';

export class DeleteRentalOrdersDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @IsUUID('7', { each: true, message: INVALID_UUID })
  rentalOrderIds!: string[];
}
