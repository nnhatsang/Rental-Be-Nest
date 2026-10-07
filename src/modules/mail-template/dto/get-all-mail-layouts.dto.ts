import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

import { INVALID_BOOLEAN } from '@/libs/constants/invalid.constant';
import { ApiPagReq } from '@/libs/types/custom-response.type';

export enum MailLayoutSortBy {
  KEY = 'key',
  NAME = 'name',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

export class GetAllMailLayoutsDto extends ApiPagReq {
  @ApiPropertyOptional({ example: true })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean({ message: INVALID_BOOLEAN })
  isActive?: boolean;

  @ApiPropertyOptional({ enum: MailLayoutSortBy, default: MailLayoutSortBy.UPDATED_AT })
  @IsEnum(MailLayoutSortBy)
  @IsOptional()
  sortBy: MailLayoutSortBy = MailLayoutSortBy.UPDATED_AT;
}
