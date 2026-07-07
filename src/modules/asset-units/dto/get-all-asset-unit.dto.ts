import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { AssetCondition, AssetStatus } from '@generated/prisma/enums';
import { INVALID_BOOLEAN, INVALID_UUID } from '@/libs/constants/invalid.constant';
import { ApiPagReq } from '@/libs/types/custom-response.type';

export enum AssetUnitSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  SERIAL_NUMBER = 'serialNumber',
  STATUS = 'status',
  CONDITION = 'condition',
  IS_ACTIVE = 'isActive',
}

export class GetAllAssetUnitsInDto extends ApiPagReq {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  productId?: string;

  @ApiPropertyOptional({ enum: Object.values(AssetStatus) })
  @IsOptional()
  @IsIn(Object.values(AssetStatus))
  status?: AssetStatus;

  @ApiPropertyOptional({ enum: Object.values(AssetCondition) })
  @IsOptional()
  @IsIn(Object.values(AssetCondition))
  condition?: AssetCondition;

  @ApiPropertyOptional({ example: true })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean({ message: INVALID_BOOLEAN })
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: AssetUnitSortBy,
    default: AssetUnitSortBy.CREATED_AT,
  })
  @IsEnum(AssetUnitSortBy)
  @IsOptional()
  sortBy: AssetUnitSortBy = AssetUnitSortBy.CREATED_AT;
}
