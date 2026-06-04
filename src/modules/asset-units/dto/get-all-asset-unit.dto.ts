import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { AssetCondition, AssetStatus } from '@generated/prisma/enums';
import { INVALID_BOOLEAN, INVALID_STRING, INVALID_UUID } from '@/libs/constants/invalid.constant';
import { ApiPagReq } from '@/libs/types/custom-response.type';

export class GetAllAssetUnitsInDto extends ApiPagReq {
  @ApiPropertyOptional({ description: 'Search by serial number, product name, SKU, or note' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  search?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: INVALID_UUID })
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
}
