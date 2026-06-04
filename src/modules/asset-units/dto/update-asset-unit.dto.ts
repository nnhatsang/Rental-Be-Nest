import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { AssetCondition, AssetStatus } from '@generated/prisma/enums';
import { INVALID_BOOLEAN, INVALID_STRING, INVALID_UUID } from '@/libs/constants/invalid.constant';

export class UpdateAssetUnitDto {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: INVALID_UUID })
  productId?: string;

  @ApiPropertyOptional({ example: 'SN-A7IV-001' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  serialNumber?: string;

  @ApiPropertyOptional({ enum: Object.values(AssetStatus), example: AssetStatus.AVAILABLE })
  @IsOptional()
  @IsIn(Object.values(AssetStatus))
  status?: AssetStatus;

  @ApiPropertyOptional({ enum: Object.values(AssetCondition), example: AssetCondition.GOOD })
  @IsOptional()
  @IsIn(Object.values(AssetCondition))
  condition?: AssetCondition;

  @ApiPropertyOptional({ example: 'Includes body cap and cage' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: INVALID_BOOLEAN })
  isActive?: boolean;
}
