import { EUserActivityStatus } from '@/libs/constants/error.constants';
import { INVALID_ENUM, INVALID_STRING } from '@/libs/constants/invalid.constant';
import { RoleCode } from '@/libs/constants/rbac.constant';
import { ApiPagReq } from '@/libs/types/custom-response.type';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

export enum UserSortBy {
  CREATED_AT = 'createdAt',
  FULL_NAME = 'fullName',
  EMAIL = 'email',
  ACTIVITY_STATUS = 'activityStatus',
}

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

  @ApiPropertyOptional({
    enum: UserSortBy,
    default: UserSortBy.CREATED_AT,
  })
  @IsEnum(UserSortBy)
  @IsOptional()
  sortBy: UserSortBy = UserSortBy.CREATED_AT;
}

export class GetListUsersByIdInDto {
  @ApiProperty({ type: [String] })
  @IsString({ each: true })
  userIds!: string[];
}
