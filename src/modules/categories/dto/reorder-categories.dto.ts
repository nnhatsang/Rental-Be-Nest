import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
import { INVALID_ARRAY, INVALID_UUID } from '@/libs/constants/invalid.constant';

export class ReorderCategoriesDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'All non-deleted category ids in their desired display order.',
    example: ['019f0000-0000-7000-8000-000000000001', '019f0000-0000-7000-8000-000000000002'],
  })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('7', { each: true, message: INVALID_UUID })
  categoryIds!: string[];
}
