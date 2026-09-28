import { ApiProperty } from '@nestjs/swagger';
import { AssetCondition, AssetStatus, OrderStatus, RentalAllocationStatus } from '@generated/prisma/enums';
import { CursorPagination } from '@/libs/types/custom-response.type';

export class AvailabilityGanttBlockOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  orderId!: string;

  @ApiProperty()
  orderCode!: string;

  @ApiProperty({ enum: OrderStatus })
  orderStatus!: OrderStatus;

  @ApiProperty({ enum: RentalAllocationStatus })
  allocationStatus!: RentalAllocationStatus;

  @ApiProperty()
  customerName!: string;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;

  @ApiProperty()
  blockedEndDate!: Date;
}

export class AvailabilityGanttAssetOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  assetUnitId!: string;

  @ApiProperty()
  serialNumber!: string;

  @ApiProperty({ enum: AssetStatus })
  status!: AssetStatus;

  @ApiProperty({ enum: AssetCondition })
  condition!: AssetCondition;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: [AvailabilityGanttBlockOutDto] })
  blocks!: AvailabilityGanttBlockOutDto[];
}

export class AvailabilityGanttProductOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  productId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty({ type: [AvailabilityGanttAssetOutDto] })
  assetUnits!: AvailabilityGanttAssetOutDto[];
}

export class AvailabilityGanttSummaryOutDto {
  @ApiProperty()
  totalProducts!: number;

  @ApiProperty()
  totalAssets!: number;

  @ApiProperty()
  scheduledAssets!: number;

  @ApiProperty()
  freeAssets!: number;

  @ApiProperty()
  unassignableAssets!: number;
}

export class AvailabilityGanttOutDto {
  @ApiProperty({ type: [AvailabilityGanttProductOutDto] })
  items!: AvailabilityGanttProductOutDto[];

  @ApiProperty({ type: CursorPagination })
  pagination!: CursorPagination;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;

  @ApiProperty({ type: AvailabilityGanttSummaryOutDto })
  summary!: AvailabilityGanttSummaryOutDto;
}
