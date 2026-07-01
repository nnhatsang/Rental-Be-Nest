import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPagReq } from '@/libs/types/custom-response.type';
import { INVALID_BOOLEAN, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class GetAllRolesDto extends ApiPagReq {
  @ApiPropertyOptional({ example: false })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean({ message: INVALID_BOOLEAN })
  isSystem?: boolean;
}
