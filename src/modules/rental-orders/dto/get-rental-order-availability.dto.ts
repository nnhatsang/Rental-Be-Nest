import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AssetCondition, AssetStatus } from '@generated/prisma/enums';
import { INVALID_DATE, INVALID_UUID } from '@/libs/constants/invalid.constant';
import { ApiPagReq, Pagination } from '@/libs/types/custom-response.type';

export enum AvailabilityFilter {
  ALL = 'ALL',
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
}

export enum ProductAvailabilityState {
  AVAILABLE = 'AVAILABLE',
  LOW_STOCK = 'LOW_STOCK',
  UNAVAILABLE = 'UNAVAILABLE',
}

export enum AssetAvailabilityState {
  AVAILABLE = 'AVAILABLE',
  BOOKED = 'BOOKED',
  UNASSIGNABLE = 'UNASSIGNABLE',
}

export enum AssetAvailabilityReason {
  BOOKED = 'BOOKED',
  INACTIVE = 'INACTIVE',
  RESERVED = 'RESERVED',
  RENTED = 'RENTED',
  INSPECTING = 'INSPECTING',
  MAINTENANCE = 'MAINTENANCE',
  CLEANING = 'CLEANING',
  TRANSFERRING = 'TRANSFERRING',
  RETIRED = 'RETIRED',
  LOST = 'LOST',
}

export class GetAvailabilityBaseDto extends ApiPagReq {
  @ApiProperty({ example: '2026-07-20T01:00:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  startDate!: Date;

  @ApiProperty({ example: '2026-07-22T11:00:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  endDate!: Date;

  @ApiPropertyOptional({ enum: AvailabilityFilter, default: AvailabilityFilter.ALL })
  @IsOptional()
  @IsEnum(AvailabilityFilter)
  availability: AvailabilityFilter = AvailabilityFilter.ALL;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  excludeOrderId?: string;
}

export class GetAvailabilityProductsDto extends GetAvailabilityBaseDto {}

export class GetAvailabilityAssetsDto extends GetAvailabilityBaseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('7', { message: INVALID_UUID })
  productId!: string;
}

export class GetAvailabilityProductAssetsDto extends GetAvailabilityBaseDto {}

export class GetAvailabilityTimelineDto extends GetAvailabilityBaseDto {}

export class AvailabilityProductPriceTierOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 3 })
  minDays!: number;

  @ApiProperty({ example: 6, nullable: true })
  maxDays!: number | null;

  @ApiProperty({ example: '180000' })
  dailyPrice!: string;

  @ApiProperty({ example: 'Combo 3-6 ngày', nullable: true })
  name!: string | null;

  @ApiProperty({ example: 0 })
  sortOrder!: number;
}

export class AvailabilityProductInventoryOutDto {
  @ApiProperty({ example: 5, description: 'Tổng máy có thể cho thuê' })
  total!: number;

  @ApiProperty({ example: 2, description: 'Số máy đã bị đơn khác giữ lịch' })
  reserved!: number;

  @ApiProperty({ example: 3, description: 'Số máy còn có thể đặt trong khoảng thời gian đang kiểm tra' })
  available!: number;
}

export class AvailabilityProductOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  productId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty({ example: '250000' })
  dailyPrice!: string;

  @ApiProperty({ example: '150000' })
  halfDayPrice!: string;

  @ApiProperty({ type: [AvailabilityProductPriceTierOutDto] })
  rentalPriceTiers!: AvailabilityProductPriceTierOutDto[];

  @ApiProperty({ type: AvailabilityProductInventoryOutDto })
  inventory!: AvailabilityProductInventoryOutDto;

  @ApiProperty({ enum: ProductAvailabilityState })
  availabilityState!: ProductAvailabilityState;
}

export class AvailabilityProductsOutDto {
  @ApiProperty({ type: [AvailabilityProductOutDto] })
  items!: AvailabilityProductOutDto[];

  @ApiProperty({ type: Pagination })
  pagination!: Pagination;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;

  @ApiProperty()
  blockedEndDate!: Date;

  @ApiProperty()
  turnaroundMinutes!: number;
}

export class AvailabilityAssetOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  assetUnitId!: string;

  @ApiProperty()
  serialNumber!: string;

  @ApiProperty({ enum: AssetStatus })
  status!: AssetStatus;

  @ApiProperty({ enum: AssetCondition })
  condition!: AssetCondition;

  @ApiProperty({ enum: AssetAvailabilityState })
  availability!: AssetAvailabilityState;

  @ApiProperty({ enum: AssetAvailabilityReason, nullable: true })
  reasonCode!: AssetAvailabilityReason | null;

  @ApiProperty({ nullable: true })
  conflictBlockedEndDate!: Date | null;
}

export class AvailabilityAssetsOutDto {
  @ApiProperty({ type: [AvailabilityAssetOutDto] })
  items!: AvailabilityAssetOutDto[];

  @ApiProperty({ type: Pagination })
  pagination!: Pagination;

  @ApiProperty({ type: String, format: 'uuid' })
  productId!: string;

  @ApiProperty()
  availableQuantity!: number;

  @ApiProperty()
  selectionLimit!: number;

  @ApiProperty()
  blockedEndDate!: Date;
}

export class AvailabilityTimelineBlockOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  orderId!: string;

  @ApiProperty()
  orderCode!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;

  @ApiProperty()
  blockedEndDate!: Date;
}

export class AvailabilityTimelineRowOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  assetUnitId!: string;

  @ApiProperty()
  serialNumber!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty({ enum: AssetStatus })
  status!: AssetStatus;

  @ApiProperty({ enum: AssetCondition })
  condition!: AssetCondition;

  @ApiProperty({ type: [AvailabilityTimelineBlockOutDto] })
  blocks!: AvailabilityTimelineBlockOutDto[];
}

export class AvailabilityTimelineOutDto {
  @ApiProperty({ type: [AvailabilityTimelineRowOutDto] })
  items!: AvailabilityTimelineRowOutDto[];

  @ApiProperty({ type: Pagination })
  pagination!: Pagination;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;
}

