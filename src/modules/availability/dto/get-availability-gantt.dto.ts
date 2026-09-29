import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  AssetCondition,
  AssetStatus,
  HandoverStatus,
  OrderStatus,
  PickupMethod,
  RentalAllocationStatus,
  RentalSettlementStatus,
  ReturnStatus,
} from '@generated/prisma/enums';
import { INVALID_UUID } from '@/libs/constants/invalid.constant';
import { ApiCursorReq } from '@/libs/types/custom-response.type';

const transformQueryArray = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.flatMap((item) => String(item).split(',')).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export class GetAvailabilityGanttDto extends ApiCursorReq {
  @ApiProperty({ example: '2026-09-25T08:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @ApiProperty({ example: '2026-09-27T18:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  productId?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'Lọc nhiều sản phẩm, phân tách bằng dấu phẩy.' })
  @IsOptional()
  @Transform(transformQueryArray)
  @IsArray()
  @IsUUID('7', { each: true, message: INVALID_UUID })
  productIds?: string[];

  @ApiPropertyOptional({ enum: Object.values(OrderStatus), isArray: true, description: 'Lọc theo trạng thái đơn.' })
  @IsOptional()
  @Transform(transformQueryArray)
  @IsArray()
  @IsEnum(OrderStatus, { each: true })
  orderStatuses?: OrderStatus[];

  @ApiPropertyOptional({ enum: Object.values(RentalAllocationStatus), isArray: true, description: 'Lọc theo trạng thái giữ máy.' })
  @IsOptional()
  @Transform(transformQueryArray)
  @IsArray()
  @IsEnum(RentalAllocationStatus, { each: true })
  allocationStatuses?: RentalAllocationStatus[];

  @ApiPropertyOptional({ enum: Object.values(HandoverStatus), isArray: true, description: 'Lọc theo trạng thái bàn giao.' })
  @IsOptional()
  @Transform(transformQueryArray)
  @IsArray()
  @IsEnum(HandoverStatus, { each: true })
  handoverStatuses?: HandoverStatus[];

  @ApiPropertyOptional({ enum: Object.values(ReturnStatus), isArray: true, description: 'Lọc theo trạng thái trả máy.' })
  @IsOptional()
  @Transform(transformQueryArray)
  @IsArray()
  @IsEnum(ReturnStatus, { each: true })
  returnStatuses?: ReturnStatus[];

  @ApiPropertyOptional({ enum: Object.values(RentalSettlementStatus), isArray: true, description: 'Lọc theo trạng thái tài chính.' })
  @IsOptional()
  @Transform(transformQueryArray)
  @IsArray()
  @IsEnum(RentalSettlementStatus, { each: true })
  settlementStatuses?: RentalSettlementStatus[];

  @ApiPropertyOptional({ enum: Object.values(PickupMethod), isArray: true, description: 'Lọc theo hình thức nhận máy.' })
  @IsOptional()
  @Transform(transformQueryArray)
  @IsArray()
  @IsEnum(PickupMethod, { each: true })
  pickupMethods?: PickupMethod[];

  @ApiPropertyOptional({ enum: Object.values(AssetStatus), isArray: true, description: 'Lọc theo trạng thái tài sản.' })
  @IsOptional()
  @Transform(transformQueryArray)
  @IsArray()
  @IsEnum(AssetStatus, { each: true })
  assetStatuses?: AssetStatus[];

  @ApiPropertyOptional({ enum: Object.values(AssetCondition), isArray: true, description: 'Lọc theo tình trạng tài sản.' })
  @IsOptional()
  @Transform(transformQueryArray)
  @IsArray()
  @IsEnum(AssetCondition, { each: true })
  assetConditions?: AssetCondition[];

  @ApiPropertyOptional({ type: Boolean, description: 'Lọc máy đang bật/tắt.' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : value === true || value === 'true'))
  @IsBoolean()
  assetActive?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Cho phép đưa các đơn đã huỷ vào lịch.' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : value === true || value === 'true'))
  @IsBoolean()
  includeCancelled?: boolean;
}
