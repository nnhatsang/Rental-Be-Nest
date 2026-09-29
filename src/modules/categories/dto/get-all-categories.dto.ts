import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiPagReq } from '@/libs/types/custom-response.type';

export enum CategorySortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  NAME = 'name',
  IS_ACTIVE = 'isActive',
}

export class GetAllCategoriesDto extends ApiPagReq {
  @ApiPropertyOptional({ enum: CategorySortBy, default: CategorySortBy.CREATED_AT })
  @IsEnum(CategorySortBy)
  @IsOptional()
  sortBy: CategorySortBy = CategorySortBy.CREATED_AT;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return value === true || value === 'true';
  })
  @IsBoolean()
  isActive?: boolean;
}
