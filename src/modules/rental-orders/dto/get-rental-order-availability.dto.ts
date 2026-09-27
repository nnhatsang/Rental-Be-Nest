import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AssetCondition, AssetStatus, RentalAllocationStatus } from '@generated/prisma/enums';
import { INVALID_DATE, INVALID_UUID } from '@/libs/constants/invalid.constant';
import { ApiPagReq, Pagination } from '@/libs/types/custom-response.type';

export enum AvailabilityFilter {
  ALL = 'ALL',
  AVAILABLE = 'AVAILABLE',
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
  MAINTENANCE = 'MAINTENANCE',
  LOST = 'LOST',
}

export class GetAvailabilityBaseDto extends ApiPagReq {
  @ApiProperty({ example: '2026-09-25T08:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @ApiProperty({ example: '2026-09-27T18:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
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
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  productId?: string;
}

export class GetAvailabilityProductAssetsDto extends GetAvailabilityBaseDto {}
export class GetAvailabilityTimelineDto extends GetAvailabilityBaseDto {}

export class AvailabilityProductPriceTierOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;
  @ApiProperty() minDays!: number;
  @ApiProperty({ nullable: true }) maxDays!: number | null;
  @ApiProperty() dailyPrice!: number;
  @ApiProperty({ nullable: true }) name!: string | null;
  @ApiProperty() sortOrder!: number;
}

export class AvailabilityProductInventoryOutDto {
  @ApiProperty() total!: number;
  @ApiProperty() reserved!: number;
  @ApiProperty() available!: number;
}

export class AvailabilityProductOutDto {
  @ApiProperty({ type: String, format: 'uuid' }) productId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() dailyPrice!: number;
  @ApiProperty() halfDayPrice!: number;
  @ApiProperty({ nullable: true }) hourlyOveragePrice!: number | null;
  @ApiProperty({ type: [AvailabilityProductPriceTierOutDto] }) rentalPriceTiers!: AvailabilityProductPriceTierOutDto[];
  @ApiProperty() depositAmount!: number;
  @ApiProperty({ type: AvailabilityProductInventoryOutDto }) inventory!: AvailabilityProductInventoryOutDto;
}

export class AvailabilityProductsOutDto {
  @ApiProperty({ type: [AvailabilityProductOutDto] }) items!: AvailabilityProductOutDto[];
  @ApiProperty({ type: Pagination }) pagination!: Pagination;
  @ApiProperty() startDate!: Date;
  @ApiProperty() endDate!: Date;
  @ApiProperty() blockedEndDate!: Date;
}

export class AvailabilityAssetProductOutDto {
  @ApiProperty({ type: String, format: 'uuid' }) productId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() dailyPrice!: number;
  @ApiProperty() halfDayPrice!: number;
  @ApiProperty({ nullable: true }) hourlyOveragePrice!: number | null;
  @ApiProperty({ type: [AvailabilityProductPriceTierOutDto] }) rentalPriceTiers!: AvailabilityProductPriceTierOutDto[];
  @ApiProperty() depositAmount!: number;
}

export class AvailabilityAssetOutDto {
  @ApiProperty({ type: String, format: 'uuid' }) assetUnitId!: string;
  @ApiProperty() serialNumber!: string;
  @ApiProperty({ enum: AssetStatus }) status!: AssetStatus;
  @ApiProperty({ enum: AssetCondition }) condition!: AssetCondition;
  @ApiProperty({ enum: AssetAvailabilityState }) availability!: AssetAvailabilityState;
  @ApiProperty({ enum: AssetAvailabilityReason, nullable: true }) reasonCode!: AssetAvailabilityReason | null;
  @ApiProperty({ nullable: true }) conflictBlockedEndDate!: Date | null;
  @ApiProperty({ type: AvailabilityAssetProductOutDto }) product!: AvailabilityAssetProductOutDto;
  @ApiProperty({ enum: RentalAllocationStatus, isArray: true, required: false }) blockingAllocationStatuses?: RentalAllocationStatus[];
}

export class AvailabilityAssetsOutDto {
  @ApiProperty({ type: [AvailabilityAssetOutDto] }) items!: AvailabilityAssetOutDto[];
  @ApiProperty({ type: Pagination }) pagination!: Pagination;
  @ApiProperty() availableQuantity!: number;
  @ApiProperty() selectionLimit!: number;
  @ApiProperty() blockedEndDate!: Date;
  @ApiProperty() bookingHoldAmountPerUnit!: number;
}

export class AvailabilityTimelineBlockOutDto {
  @ApiProperty({ type: String, format: 'uuid' }) orderId!: string;
  @ApiProperty() orderCode!: string;
  @ApiProperty() status!: string;
  @ApiProperty() customerName!: string;
  @ApiProperty() startDate!: Date;
  @ApiProperty() endDate!: Date;
  @ApiProperty() blockedEndDate!: Date;
}

export class AvailabilityTimelineRowOutDto {
  @ApiProperty({ type: String, format: 'uuid' }) assetUnitId!: string;
  @ApiProperty() serialNumber!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() sku!: string;
  @ApiProperty({ enum: AssetStatus }) status!: AssetStatus;
  @ApiProperty({ enum: AssetCondition }) condition!: AssetCondition;
  @ApiProperty({ type: [AvailabilityTimelineBlockOutDto] }) blocks!: AvailabilityTimelineBlockOutDto[];
}

export class AvailabilityTimelineOutDto {
  @ApiProperty({ type: [AvailabilityTimelineRowOutDto] }) items!: AvailabilityTimelineRowOutDto[];
  @ApiProperty({ type: Pagination }) pagination!: Pagination;
  @ApiProperty() startDate!: Date;
  @ApiProperty() endDate!: Date;
}
