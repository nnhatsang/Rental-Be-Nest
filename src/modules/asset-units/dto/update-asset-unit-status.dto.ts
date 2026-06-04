import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { AssetCondition, AssetStatus } from '@generated/prisma/enums';
import { INVALID_BOOLEAN } from '@/libs/constants/invalid.constant';

export class UpdateAssetUnitStatusDto {
  @ApiProperty({ enum: Object.values(AssetStatus), example: AssetStatus.AVAILABLE })
  @IsIn(Object.values(AssetStatus))
  status!: AssetStatus;

  @ApiProperty({ enum: Object.values(AssetCondition), example: AssetCondition.GOOD })
  @IsIn(Object.values(AssetCondition))
  condition!: AssetCondition;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean({ message: INVALID_BOOLEAN })
  isActive?: boolean;
}
