import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPagReq } from '@/libs/types/custom-response.type';
import { INVALID_DATE, INVALID_ENUM, INVALID_STRING } from '@/libs/constants/invalid.constant';

export enum DashboardAttentionType {
  PAYMENT_CONFIRMATION = 'PAYMENT_CONFIRMATION',
  PICKUP_DUE = 'PICKUP_DUE',
  RETURN_DUE = 'RETURN_DUE',
  OVERDUE_RETURN = 'OVERDUE_RETURN',
  REFUND_PENDING = 'REFUND_PENDING',
  DISPUTE = 'DISPUTE',
}

export enum DashboardAttentionPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum DashboardScheduleType {
  PICKUP = 'PICKUP',
  RETURN = 'RETURN',
}

export enum DashboardTrendGroupBy {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

const transformBooleanQuery = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === '') return undefined;
  return value === true || value === 'true';
};

export class DashboardDateRangeDto {
  @ApiProperty({ example: '2026-10-03T00:00:00.000+07:00' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  fromDate!: Date;

  @ApiProperty({ example: '2026-10-04T00:00:00.000+07:00' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  toDate!: Date;

  @ApiPropertyOptional({ default: 'Asia/Ho_Chi_Minh', example: 'Asia/Ho_Chi_Minh' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  @IsNotEmpty({ message: INVALID_STRING })
  @MaxLength(64, { message: INVALID_STRING })
  timezone = 'Asia/Ho_Chi_Minh';

  @ApiPropertyOptional({ default: false, description: 'Bao gồm đơn đã hủy trong các số liệu tổng hợp.' })
  @IsOptional()
  @Transform(transformBooleanQuery)
  @IsBoolean()
  includeCancelled = false;
}

export class GetDashboardOperationsDto extends DashboardDateRangeDto {}

export class GetDashboardAttentionQueryDto extends ApiPagReq {
  @ApiProperty({ example: '2026-10-03T00:00:00.000+07:00' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  fromDate!: Date;

  @ApiProperty({ example: '2026-10-04T00:00:00.000+07:00' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  toDate!: Date;

  @ApiPropertyOptional({ default: 'Asia/Ho_Chi_Minh', example: 'Asia/Ho_Chi_Minh' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  @IsNotEmpty({ message: INVALID_STRING })
  @MaxLength(64, { message: INVALID_STRING })
  timezone = 'Asia/Ho_Chi_Minh';

  @ApiPropertyOptional({ default: false, description: 'Bao gồm đơn đã hủy trong các số liệu tổng hợp.' })
  @IsOptional()
  @Transform(transformBooleanQuery)
  @IsBoolean()
  includeCancelled = false;

  @ApiPropertyOptional({ enum: DashboardAttentionType })
  @IsOptional()
  @IsEnum(DashboardAttentionType, { message: INVALID_ENUM(Object.values(DashboardAttentionType), 'type') })
  type?: DashboardAttentionType;
}

export class GetDashboardTrendsDto extends DashboardDateRangeDto {
  @ApiPropertyOptional({ enum: DashboardTrendGroupBy, default: DashboardTrendGroupBy.DAY })
  @IsOptional()
  @IsEnum(DashboardTrendGroupBy, { message: INVALID_ENUM(Object.values(DashboardTrendGroupBy), 'groupBy') })
  groupBy: DashboardTrendGroupBy = DashboardTrendGroupBy.DAY;
}

