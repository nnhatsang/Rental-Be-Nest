import { ApiProperty } from '@nestjs/swagger';
import { OrderSource, OrderStatus, PaymentStatus, PickupMethod } from '@generated/prisma/enums';

export class RentalOrderCustomerOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  name!: string;

  @ApiProperty({ example: '0900000000', nullable: true })
  phone!: string | null;

  @ApiProperty({ example: 'customer@example.com', nullable: true })
  email!: string | null;
}

export class RentalOrderUserOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'System Admin' })
  fullName!: string;

  @ApiProperty({ example: 'admin@rental.local' })
  email!: string;
}

export class RentalOrderProductOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Sony A7 IV' })
  name!: string;

  @ApiProperty({ example: 'SONY-A7-IV', nullable: true })
  sku!: string | null;
}

export class RentalOrderAssetUnitOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'SN-A7IV-001', nullable: true })
  serialNumber!: string | null;
}

export class RentalOrderItemOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: RentalOrderProductOutDto })
  product!: RentalOrderProductOutDto;

  @ApiProperty({ type: RentalOrderAssetUnitOutDto, nullable: true })
  assetUnit!: RentalOrderAssetUnitOutDto | null;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: 'Sony A7 IV' })
  productNameSnapshot!: string;

  @ApiProperty({ example: 'SONY-A7-IV', nullable: true })
  skuSnapshot!: string | null;

  @ApiProperty({ example: '200000' })
  unitPrice!: string;

  @ApiProperty({ example: '50000' })
  bookingHoldAmount!: string;

  @ApiProperty({ example: '800000' })
  upfrontAmount!: string;

  @ApiProperty({ example: '600000' })
  refundableDepositAmount!: string;

  @ApiProperty({ example: '800000' })
  depositAmount!: string;

  @ApiProperty({ example: '200000' })
  lineTotal!: string;

  @ApiProperty({ example: 'Body + 1 battery + charger', nullable: true })
  note!: string | null;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;
}

export class RentalOrderOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ORD-000001' })
  code!: string;

  @ApiProperty({ enum: Object.values(OrderSource), example: OrderSource.ADMIN })
  source!: OrderSource;

  @ApiProperty({ enum: Object.values(OrderStatus), example: OrderStatus.DRAFT })
  status!: OrderStatus;

  @ApiProperty({ enum: Object.values(PaymentStatus), example: PaymentStatus.UNPAID })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  rentalPolicyId!: string | null;

  @ApiProperty({ type: RentalOrderCustomerOutDto })
  customer!: RentalOrderCustomerOutDto;

  @ApiProperty({ example: 'Nguyen Van A' })
  customerNameSnapshot!: string;

  @ApiProperty({ example: '0900000000', nullable: true })
  customerPhoneSnapshot!: string | null;

  @ApiProperty({ example: 'customer@example.com', nullable: true })
  customerEmailSnapshot!: string | null;

  @ApiProperty({ example: '123 Nguyen Trai, Quan 1, TP.HCM', nullable: true })
  customerAddressSnapshot!: string | null;

  @ApiProperty({ example: '079000000001', nullable: true })
  customerIdentitySnapshot!: string | null;

  @ApiProperty({ type: Date, format: 'date-time' })
  startDate!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  endDate!: Date;

  @ApiProperty({ example: 60 })
  turnaroundMinutes!: number;

  @ApiProperty({ type: Date, format: 'date-time' })
  blockedEndDate!: Date;

  @ApiProperty({ type: Date, format: 'date-time', nullable: true })
  holdExpiresAt!: Date | null;

  @ApiProperty({ type: Date, format: 'date-time', nullable: true })
  actualReturnDate!: Date | null;

  @ApiProperty({ enum: Object.values(PickupMethod), example: PickupMethod.PICKUP_AT_STORE })
  pickupMethod!: PickupMethod;

  @ApiProperty({ example: '123 Nguyen Trai, Quan 1, TP.HCM', nullable: true })
  deliveryAddress!: string | null;

  @ApiProperty({ example: '30000' })
  deliveryFeeTotal!: string;

  @ApiProperty({ example: '200000' })
  subtotal!: string;

  @ApiProperty({ example: '600000' })
  depositTotal!: string;

  @ApiProperty({ example: '800000' })
  upfrontTotal!: string;

  @ApiProperty({ example: '50000' })
  bookingHoldTotal!: string;

  @ApiProperty({ example: '750000' })
  handoverDueTotal!: string;

  @ApiProperty({ example: '0' })
  lateFeeTotal!: string;

  @ApiProperty({ example: '0' })
  damageFeeTotal!: string;

  @ApiProperty({ example: '0' })
  discountTotal!: string;

  @ApiProperty({ example: '50000' })
  paidTotal!: string;

  @ApiProperty({ example: '750000' })
  remainingTotal!: string;

  @ApiProperty({ example: '600000' })
  refundTotal!: string;

  @ApiProperty({ example: 'Khach se den lay luc 7h', nullable: true })
  note!: string | null;

  @ApiProperty({ example: 'Can kiem tra pin truoc khi giao', nullable: true })
  internalNote!: string | null;

  @ApiProperty({ example: 'Khach huy lich', nullable: true })
  cancelReason!: string | null;

  @ApiProperty({ type: RentalOrderUserOutDto })
  createdBy!: RentalOrderUserOutDto;

  @ApiProperty({ type: RentalOrderUserOutDto, nullable: true })
  assignedTo!: RentalOrderUserOutDto | null;

  @ApiProperty({ type: [RentalOrderItemOutDto] })
  items!: RentalOrderItemOutDto[];

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time', nullable: true })
  deletedAt!: Date | null;
}
