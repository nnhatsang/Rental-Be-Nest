import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { SortOrder } from '@/libs/constants/common.constant';
import { ApiPagReq } from '@/libs/types/custom-response.type';

export enum CategorySortBy {
  ORDER = 'order',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  NAME = 'name',
  IS_ACTIVE = 'isActive',
}

export class GetAllCategoriesDto extends ApiPagReq {
  @ApiPropertyOptional({ enum: CategorySortBy, default: CategorySortBy.ORDER })
  @IsEnum(CategorySortBy)
  @IsOptional()
  sortBy: CategorySortBy = CategorySortBy.ORDER;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.asc })
  @IsEnum(SortOrder)
  @IsOptional()
  sort: SortOrder = SortOrder.asc;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return value === true || value === 'true';
  })
  @IsBoolean()
  isActive?: boolean;
}
