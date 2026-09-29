import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { INVALID_BOOLEAN, INVALID_UUID } from '@/libs/constants/invalid.constant';
import { ApiPagReq } from '@/libs/types/custom-response.type';

export enum ProductSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  NAME = 'name',
  SKU = 'sku',
  DAILY_PRICE = 'dailyPrice',
  DEPOSIT_AMOUNT = 'depositAmount',
  IS_ACTIVE = 'isActive',
}

export class GetAllProductsInDto extends ApiPagReq {
  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'Lọc sản phẩm thuộc ít nhất một danh mục.' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (Array.isArray(value)) return value.flatMap((item) => String(item).split(',')).filter(Boolean);
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
  })
  @IsArray()
  @IsUUID('7', { each: true, message: INVALID_UUID })
  categoryIds?: string[];

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  brandId?: string;

  @ApiPropertyOptional({ example: true })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean({ message: INVALID_BOOLEAN })
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: ProductSortBy,
    default: ProductSortBy.CREATED_AT,
  })
  @IsEnum(ProductSortBy)
  @IsOptional()
  sortBy: ProductSortBy = ProductSortBy.CREATED_AT;
}
