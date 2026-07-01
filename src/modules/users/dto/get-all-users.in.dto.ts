import { EUserActivityStatus } from '@/libs/constants/error.constants';
import { INVALID_ENUM, INVALID_STRING } from '@/libs/constants/invalid.constant';
import { RoleCode } from '@/libs/constants/rbac.constant';
import { ApiPagReq } from '@/libs/types/custom-response.type';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

export class GetAllUsersInDto extends ApiPagReq {
  @ApiPropertyOptional({ enum: Object.values(EUserActivityStatus) })
  @IsIn(Object.values(EUserActivityStatus))
  @IsOptional()
  status?: EUserActivityStatus;

  @ApiPropertyOptional({ enum: Object.values(RoleCode) })
  @IsString()
  @IsOptional()
  roleCode?: string;

  @ApiPropertyOptional({ enum: Object.values(RoleCode), description: 'Loại trừ users đang có role này' })
  @IsString()
  @IsOptional()
  excludeRoleCode?: string;
}

export class GetListUsersByIdInDto {
  @ApiProperty({ type: [String] })
  @IsString({ each: true })
  userIds!: string[];
}
