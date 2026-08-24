import { ApiProperty } from '@nestjs/swagger';
import {
  CollateralType,
  OrderSource,
  OrderStatus,
  PaymentKind,
  PaymentMethod,
  PaymentRecordStatus,
  PaymentStatus,
  PickupMethod,
  RefundStatus,
  RentalOrderItemStatus,
} from '@generated/prisma/enums';

export class RentalOrderRentalPeriodOutDto {
  @ApiProperty({ type: Date, format: 'date-time' })
  startDate!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  endDate!: Date;

  @ApiProperty({ type: Date, format: 'date-time', nullable: true, required: false })
  actualPickupDate?: Date | null;

  @ApiProperty({ type: Date, format: 'date-time', nullable: true, required: false })
  actualReturnDate?: Date | null;

  @ApiProperty({ type: Date, format: 'date-time', required: false })
  blockedEndDate?: Date;
}

export class RentalOrderFulfillmentOutDto {
  @ApiProperty({ enum: Object.values(PickupMethod), example: PickupMethod.PICKUP_AT_STORE })
  pickupMethod!: PickupMethod;

  @ApiProperty({ example: '123 Nguyen Trai, Quan 1, TP.HCM', nullable: true })
  deliveryAddress!: string | null;

  @ApiProperty({ example: 'Giu CCCD ban goc', nullable: true })
  collateralDescription!: string | null;

  @ApiProperty({ enum: Object.values(CollateralType), example: CollateralType.IDENTITY_CARD })
  collateralType!: CollateralType;
}

export class RentalOrderFinancialsOutDto {
  @ApiProperty({ example: 30000 })
  deliveryFeeTotal!: number;

  @ApiProperty({ example: 200000 })
  rentalFeeTotal!: number;

  @ApiProperty({ example: 600000 })
  depositTotal!: number;

  @ApiProperty({ example: 50000 })
  bookingHoldTotal!: number;

  @ApiProperty({ example: 0 })
  lateFeeTotal!: number;

  @ApiProperty({ example: 0 })
  damageFeeTotal!: number;

  @ApiProperty({ example: 0 })
  discountTotal!: number;

  @ApiProperty({ example: 0 })
  compensationFeeTotal!: number;

  @ApiProperty({ example: 200000 })
  chargeTotal!: number;

  @ApiProperty({ example: 50000 })
  paidTotal!: number;

  @ApiProperty({ example: 600000 })
  estimatedRefundTotal!: number;

  @ApiProperty({ example: 0 })
  actualRefundTotal!: number;

  @ApiProperty({ example: 2000000 })
  adjustedDepositTotal!: number;

  @ApiProperty({ example: 1500000 })
  handoverRequiredTotal!: number;

  @ApiProperty({ example: 1450000 })
  handoverAmountDue!: number;

  @ApiProperty({ example: 230000 })
  rentalRevenueTotal!: number;

  @ApiProperty({ example: 50000 })
  incidentFeeTotal!: number;

  @ApiProperty({ example: 280000 })
  finalPayableTotal!: number;

  @ApiProperty({ example: 320000 })
  refundDue!: number;

  @ApiProperty({ example: 0 })
  additionalChargeDue!: number;

  @ApiProperty({ enum: ['NEED_COLLECT', 'NEED_REFUND', 'SETTLED'], example: 'NEED_REFUND' })
  settlementStatus!: 'NEED_COLLECT' | 'NEED_REFUND' | 'SETTLED';
}

export class RentalOrderNotesOutDto {
  @ApiProperty({ example: 'Khach se den lay luc 7h', nullable: true })
  customerNote!: string | null;

  @ApiProperty({ example: 'Can kiem tra pin truoc khi giao', nullable: true })
  internalNote!: string | null;

  @ApiProperty({ example: 'Khach huy lich', nullable: true })
  cancelReason!: string | null;
}

export class RentalOrderItemPricingOutDto {
  @ApiProperty({ example: 'DAILY_TIER' })
  pricingMode!: string;

  @ApiProperty({ example: 'Gia 1-2 ngay' })
  pricingLabel!: string;

  @ApiProperty({ example: 57 })
  durationHours!: number;

  @ApiProperty({ example: 2 })
  billableDays!: number;

  @ApiProperty({ example: 0 })
  billableHalfDays!: number;

  @ApiProperty({ example: 0 })
  overageHours!: number;

  @ApiProperty({ example: 300000 })
  unitPrice!: number;

  @ApiProperty({ example: 800000 })
  depositAmount!: number;

  @ApiProperty({ example: 50000 })
  bookingHoldAmount!: number;

  @ApiProperty({ example: 600000 })
  lineTotal!: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  appliedTierId!: string | null;

  @ApiProperty({ type: Object, nullable: true })
  appliedTier!: unknown;
}

export class RentalOrderItemOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  productId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  assetUnitId!: string;

  @ApiProperty({ enum: RentalOrderItemStatus })
  status!: RentalOrderItemStatus;

  @ApiProperty({ type: Object })
  productSnapshot!: unknown;

  @ApiProperty({ type: Object })
  assetUnitSnapshot!: unknown;

  @ApiProperty({ type: RentalOrderRentalPeriodOutDto })
  rentalPeriod!: RentalOrderRentalPeriodOutDto;

  @ApiProperty({ type: RentalOrderItemPricingOutDto })
  pricing!: RentalOrderItemPricingOutDto;

  @ApiProperty({ example: 'Body + 1 battery + charger', nullable: true })
  note!: string | null;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;
}

export class RentalOrderPaymentRecordOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: PaymentKind })
  kind!: PaymentKind;

  @ApiProperty({ enum: PaymentMethod })
  method!: PaymentMethod;

  @ApiProperty({ enum: PaymentRecordStatus })
  status!: PaymentRecordStatus;

  @ApiProperty({ example: 500000 })
  amount!: number;

  @ApiProperty({ example: 'BANK-FT-001', nullable: true })
  referenceCode!: string | null;

  @ApiProperty({ example: 'Khach chuyen khoan', nullable: true })
  note!: string | null;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;
}

export class RentalOrderStatusHistoryOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: OrderStatus, nullable: true })
  fromStatus!: OrderStatus | null;

  @ApiProperty({ enum: OrderStatus })
  toStatus!: OrderStatus;

  @ApiProperty({ example: 'Order confirmed', nullable: true })
  note!: string | null;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;
}

export class RentalOrderLogChangeOutDto {
  @ApiProperty({ example: 'customerSnapshot.phone' })
  field!: string;

  @ApiProperty({ example: 'So dien thoai' })
  label!: string;

  @ApiProperty({ nullable: true })
  oldValue!: unknown;

  @ApiProperty({ nullable: true })
  newValue!: unknown;
}

export class RentalOrderLogOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  orderId!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  actorId!: string | null;

  @ApiProperty({ example: 'UPDATE_ORDER' })
  action!: string;

  @ApiProperty({ example: 'RENTAL_ORDER' })
  entity!: string;

  @ApiProperty({ type: [RentalOrderLogChangeOutDto] })
  changes!: RentalOrderLogChangeOutDto[];

  @ApiProperty({ type: Object, nullable: true })
  actorSnapshot!: unknown;

  @ApiProperty({ example: 'Gia han them 1 ngay', nullable: true })
  note!: string | null;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;
}

export class RentalOrderOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ORD-000001' })
  code!: string;

  @ApiProperty({ enum: Object.values(OrderSource), example: OrderSource.ADMIN })
  source!: OrderSource;

  @ApiProperty({ enum: Object.values(OrderStatus), example: OrderStatus.CREATED })
  status!: OrderStatus;

  @ApiProperty({ enum: Object.values(PaymentStatus), example: PaymentStatus.UNPAID })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ enum: Object.values(RefundStatus), example: RefundStatus.NOT_REQUIRED })
  refundStatus!: RefundStatus;

  @ApiProperty({ type: String, format: 'uuid' })
  customerId!: string;

  @ApiProperty({ type: Object })
  customerSnapshot!: unknown;

  @ApiProperty({ type: Object })
  settingsSnapshot!: unknown;

  @ApiProperty({ type: RentalOrderRentalPeriodOutDto })
  rentalPeriod!: RentalOrderRentalPeriodOutDto;

  @ApiProperty({ type: RentalOrderFulfillmentOutDto })
  fulfillment!: RentalOrderFulfillmentOutDto;

  @ApiProperty({ type: RentalOrderFinancialsOutDto })
  financials!: RentalOrderFinancialsOutDto;

  @ApiProperty({ type: RentalOrderNotesOutDto })
  notes!: RentalOrderNotesOutDto;

  @ApiProperty({ type: [RentalOrderItemOutDto] })
  items!: RentalOrderItemOutDto[];

  @ApiProperty({ type: [RentalOrderPaymentRecordOutDto] })
  payments!: RentalOrderPaymentRecordOutDto[];

  @ApiProperty({ type: [RentalOrderStatusHistoryOutDto] })
  statusHistories!: RentalOrderStatusHistoryOutDto[];

  @ApiProperty({ type: [RentalOrderLogOutDto] })
  logs!: RentalOrderLogOutDto[];

  @ApiProperty({ type: String, format: 'uuid' })
  createdBy!: string;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time', nullable: true })
  deletedAt!: Date | null;
}

export class RentalOrderListItemOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ORD-000001' })
  code!: string;

  @ApiProperty({ enum: Object.values(OrderSource), example: OrderSource.ADMIN })
  source!: OrderSource;

  @ApiProperty({ enum: Object.values(OrderStatus), example: OrderStatus.CREATED })
  status!: OrderStatus;

  @ApiProperty({ enum: Object.values(PaymentStatus), example: PaymentStatus.UNPAID })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ enum: Object.values(RefundStatus), example: RefundStatus.NOT_REQUIRED })
  refundStatus!: RefundStatus;

  @ApiProperty({ type: Object })
  customerSnapshot!: unknown;

  @ApiProperty({ type: Date, format: 'date-time' })
  startDate!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  endDate!: Date;

  @ApiProperty({ example: 30000 })
  deliveryFeeTotal!: number;

  @ApiProperty({ example: 1200000 })
  rentalFeeTotal!: number;

  @ApiProperty({ example: 600000 })
  depositTotal!: number;

  @ApiProperty({ example: 50000 })
  bookingHoldTotal!: number;

  @ApiProperty({ example: 0 })
  lateFeeTotal!: number;

  @ApiProperty({ example: 0 })
  damageFeeTotal!: number;

  @ApiProperty({ example: 0 })
  discountTotal!: number;

  @ApiProperty({ example: 0 })
  compensationFeeTotal!: number;

  @ApiProperty({ example: 1200000 })
  chargeTotal!: number;

  @ApiProperty({ example: 50000 })
  paidTotal!: number;

  @ApiProperty({ example: 600000 })
  estimatedRefundTotal!: number;

  @ApiProperty({ example: 0 })
  actualRefundTotal!: number;

  @ApiProperty({ example: 1500000 })
  handoverRequiredTotal!: number;

  @ApiProperty({ example: 1450000 })
  handoverAmountDue!: number;

  @ApiProperty({ example: 230000 })
  rentalRevenueTotal!: number;

  @ApiProperty({ example: 50000 })
  incidentFeeTotal!: number;

  @ApiProperty({ example: 280000 })
  finalPayableTotal!: number;

  @ApiProperty({ example: 320000 })
  refundDue!: number;

  @ApiProperty({ example: 0 })
  additionalChargeDue!: number;

  @ApiProperty({ enum: ['NEED_COLLECT', 'NEED_REFUND', 'SETTLED'], example: 'NEED_REFUND' })
  settlementStatus!: 'NEED_COLLECT' | 'NEED_REFUND' | 'SETTLED';

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;
}
