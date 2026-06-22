import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';
import { INVALID_ARRAY, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class DeleteAssetUnitsDto {
  @ApiProperty({ type: [String], example: ['asset-uuid-1', 'asset-uuid-2'] })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @IsString({ each: true, message: INVALID_STRING })
  assetUnitIds!: string[];
}
