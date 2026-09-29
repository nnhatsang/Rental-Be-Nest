import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty({ nullable: true })
  customerPhone!: string | null;

  @ApiProperty({ nullable: true })
  customerSocialContact!: string | null;

  @ApiProperty({ enum: PickupMethod })
  pickupMethod!: PickupMethod;

  @ApiProperty({ nullable: true })
  deliveryAddress!: string | null;

  @ApiProperty({ enum: HandoverStatus })
  handoverStatus!: HandoverStatus;

  @ApiProperty({ enum: ReturnStatus })
  returnStatus!: ReturnStatus;

  @ApiProperty({ enum: RentalSettlementStatus })
  settlementStatus!: RentalSettlementStatus;

  @ApiProperty({ nullable: true })
  customerNote!: string | null;

  @ApiProperty({ nullable: true })
  internalNote!: string | null;

  @ApiProperty({ nullable: true })
  cancelReason!: string | null;

  @ApiProperty()
  paidTotal!: number;

  @ApiProperty()
  amountDueBeforeHandover!: number;

  @ApiProperty()
  refundDue!: number;

  @ApiProperty()
  totalCustomerObligation!: number;

  @ApiProperty()
  amountDueAtBooking!: number;

  @ApiProperty()
  additionalChargeDue!: number;

  @ApiProperty()
  actualRefundTotal!: number;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;

  @ApiProperty({
    description: 'Mốc kết thúc vùng chiếm lịch để tính khả dụng; không hiển thị trực tiếp cho người dùng.',
  })
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
