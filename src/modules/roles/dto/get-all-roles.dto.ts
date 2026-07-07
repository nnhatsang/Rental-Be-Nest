import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiPagReq } from '@/libs/types/custom-response.type';
import { INVALID_BOOLEAN } from '@/libs/constants/invalid.constant';

export enum RoleSortBy {
  IS_SYSTEM = 'isSystem',
  CODE = 'code',
  NAME = 'name',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

export class GetAllRolesDto extends ApiPagReq {
  @ApiPropertyOptional({ example: false })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean({ message: INVALID_BOOLEAN })
  isSystem?: boolean;

  @ApiPropertyOptional({
    enum: RoleSortBy,
    default: RoleSortBy.IS_SYSTEM,
  })
  @IsEnum(RoleSortBy)
  @IsOptional()
  sortBy: RoleSortBy = RoleSortBy.IS_SYSTEM;
}
