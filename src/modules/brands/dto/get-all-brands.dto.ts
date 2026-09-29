import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiPagReq } from '@/libs/types/custom-response.type';

export enum BrandSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  NAME = 'name',
  IS_ACTIVE = 'isActive',
}

export class GetAllBrandsDto extends ApiPagReq {
  @ApiPropertyOptional({ enum: BrandSortBy, default: BrandSortBy.CREATED_AT })
  @IsEnum(BrandSortBy)
  @IsOptional()
  sortBy: BrandSortBy = BrandSortBy.CREATED_AT;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return value === true || value === 'true';
  })
  @IsBoolean()
  isActive?: boolean;
}
