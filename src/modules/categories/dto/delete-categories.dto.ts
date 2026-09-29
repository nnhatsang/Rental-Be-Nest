import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { INVALID_ARRAY, INVALID_UUID } from '@/libs/constants/invalid.constant';

export class DeleteCategoriesDto {
  @ApiProperty({ type: [String], example: ['019f0000-0000-7000-8000-000000000001'] })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @IsUUID('7', { each: true, message: INVALID_UUID })
  categoryIds!: string[];
}
