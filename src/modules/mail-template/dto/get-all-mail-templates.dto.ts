import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { INVALID_BOOLEAN } from '@/libs/constants/invalid.constant';
import { ApiPagReq } from '@/libs/types/custom-response.type';

export enum MailTemplateSortBy {
  KEY = 'key',
  NAME = 'name',
  IS_ACTIVE = 'isActive',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

export class GetAllMailTemplatesDto extends ApiPagReq {
  @ApiPropertyOptional({ example: true })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean({ message: INVALID_BOOLEAN })
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: MailTemplateSortBy,
    default: MailTemplateSortBy.UPDATED_AT,
  })
  @IsEnum(MailTemplateSortBy)
  @IsOptional()
  sortBy: MailTemplateSortBy = MailTemplateSortBy.UPDATED_AT;
}
