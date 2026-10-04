import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  HandoverStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentTransactionStatus,
  PickupMethod,
  RentalAccessoryStatus,
  RentalAllocationSource,
  RentalAllocationStatus,
  RentalChargeKind,
  RentalChargeStatus,
  RentalInspectionCondition,
  RentalInspectionType,
  RentalRefundStatus,
  RentalSettlementStatus,
  ReturnStatus,
} from '@generated/prisma/enums';
import { RentalOrderUnavailableItemDto } from './rental-order-unavailable-item.dto';

export class RentalOrderQuoteLineOutDto {
  @ApiProperty() productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() unitRentalFee!: number;
  @ApiProperty() unitDepositAmount!: number;
  @ApiProperty() unitBookingHoldAmount!: number;
  @ApiProperty() lineRentalTotal!: number;
  @ApiProperty() lineDepositTotal!: number;
  @ApiProperty() lineBookingHoldTotal!: number;
  @ApiProperty() pricingMode!: string;
  @ApiProperty() pricingLabel!: string;
  @ApiProperty({ nullable: true }) appliedTierId!: string | null;
}

export class RentalOrderQuoteSummaryOutDto {
  @ApiProperty() rentalFeeTotal!: number;
  @ApiProperty() deliveryFeeTotal!: number;
  @ApiProperty() bookingHoldTotal!: number;
  @ApiProperty() securityDepositTotal!: number;
  @ApiProperty() totalCustomerObligation!: number;
  @ApiProperty() amountDueAtBooking!: number;
  @ApiProperty() amountDueBeforeHandover!: number;
}

export class RentalOrderQuoteAvailabilityOutDto {
  @ApiProperty() available!: boolean;
  @ApiProperty({ type: [RentalOrderUnavailableItemDto] }) conflicts!: RentalOrderUnavailableItemDto[];
}

export class RentalOrderQuoteOutDto {
  @ApiProperty() quoteId!: string;
  @ApiProperty() expiresAt!: Date;
  @ApiProperty() policyVersion!: string;
  @ApiProperty({ type: RentalOrderQuoteAvailabilityOutDto }) availability!: RentalOrderQuoteAvailabilityOutDto;
  @ApiProperty({ type: [RentalOrderQuoteLineOutDto] }) lines!: RentalOrderQuoteLineOutDto[];
  @ApiProperty({ type: RentalOrderQuoteSummaryOutDto }) summary!: RentalOrderQuoteSummaryOutDto;
}

export class RentalOrderCustomerSnapshotOutDto {
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ nullable: true }) email!: string | null;
  @ApiPropertyOptional({ nullable: true }) address!: string | null;
  @ApiPropertyOptional({ nullable: true }) identityNumber!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'zalo.me/0900000000' })
  socialContact!: string | null;
}

export class RentalOrderAllocationOutDto {
  @ApiProperty() id!: string;
  @ApiProperty() assetUnitId!: string;
  @ApiProperty() serialNumber!: string;
  @ApiProperty({ enum: RentalAllocationSource }) source!: RentalAllocationSource;
  @ApiProperty({ enum: RentalAllocationStatus }) status!: RentalAllocationStatus;
  @ApiProperty() startDate!: Date;
  @ApiProperty() endDate!: Date;
  @ApiProperty() blockedEndDate!: Date;
}

export class RentalOrderLineOutDto {
  @ApiProperty() id!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() sku!: string;
  @ApiProperty({ example: 3, description: 'Số asset unit chưa bị xóa thuộc product.' })
  assetUnitCount!: number;
  @ApiProperty() quantity!: number;
  @ApiProperty() unitRentalFee!: number;
  @ApiProperty() unitDepositAmount!: number;
  @ApiProperty() unitBookingHoldAmount!: number;
  @ApiProperty() lineRentalTotal!: number;
  @ApiProperty() lineDepositTotal!: number;
  @ApiProperty() lineBookingHoldTotal!: number;
  @ApiProperty({ nullable: true }) accessoriesSnapshot!: unknown;
  @ApiProperty({ nullable: true }) note!: string | null;
  @ApiProperty({ type: [RentalOrderAllocationOutDto] }) allocations!: RentalOrderAllocationOutDto[];
}

export class RentalOrderChargeOutDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: RentalChargeKind }) kind!: RentalChargeKind;
  @ApiProperty() amount!: number;
  @ApiProperty({ enum: RentalChargeStatus }) status!: RentalChargeStatus;
  @ApiProperty() refundable!: boolean;
  @ApiProperty({ nullable: true }) metadata!: unknown;
}

export class RentalOrderPaymentOutDto {
  @ApiProperty() id!: string;
  @ApiProperty() direction!: string;
  @ApiProperty() amount!: number;
  @ApiProperty({ enum: PaymentMethod }) method!: PaymentMethod;
  @ApiProperty({ enum: PaymentTransactionStatus }) status!: PaymentTransactionStatus;
  @ApiProperty({ nullable: true }) referenceCode!: string | null;
  @ApiProperty({ nullable: true }) idempotencyKey!: string | null;
  @ApiProperty() createdAt!: Date;
}

export class RentalOrderRefundOutDto {
  @ApiProperty() id!: string;
  @ApiProperty() amount!: number;
  @ApiProperty({ enum: RentalRefundStatus }) status!: RentalRefundStatus;
  @ApiProperty({ enum: PaymentMethod }) method!: PaymentMethod;
  @ApiProperty({ nullable: true }) referenceCode!: string | null;
  @ApiProperty() createdAt!: Date;
}

export class RentalInspectionItemOutDto {
  @ApiProperty() allocationId!: string;
  @ApiProperty({ enum: RentalInspectionCondition }) condition!: RentalInspectionCondition;
  @ApiProperty({ nullable: true }) note!: string | null;
  @ApiProperty({ type: [Object] }) accessories!: Array<{
    name: string;
    expectedQuantity: number;
    actualQuantity: number;
    status: RentalAccessoryStatus;
    note: string | null;
  }>;
}

export class RentalInspectionOutDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: RentalInspectionType }) type!: RentalInspectionType;
  @ApiProperty() inspectedAt!: Date;
  @ApiProperty({ type: [RentalInspectionItemOutDto] }) items!: RentalInspectionItemOutDto[];
  @ApiProperty({ nullable: true }) note!: string | null;
}

export class RentalOrderFinancialsOutDto {
  @ApiProperty() rentalFeeTotal!: number;
  @ApiProperty() deliveryFeeTotal!: number;
  @ApiProperty() bookingHoldTotal!: number;
  @ApiProperty() securityDepositTotal!: number;
  @ApiProperty() lateFeeTotal!: number;
  @ApiProperty() damageCompensationTotal!: number;
  @ApiProperty() cancellationFeeTotal!: number;
  @ApiProperty() totalCustomerObligation!: number;
  @ApiProperty() paidTotal!: number;
  @ApiProperty() amountDueAtBooking!: number;
  @ApiProperty() amountDueBeforeHandover!: number;
  @ApiProperty() refundDue!: number;
  @ApiProperty({ description: 'Tổng các yêu cầu hoàn đang chờ xác nhận hoặc đang xử lý.' })
  pendingRefundTotal!: number;
  @ApiProperty({ description: 'Số tiền còn có thể tạo yêu cầu hoàn mới; bằng 0 khi đơn đã chốt tài chính dù refundDue gốc vẫn còn.' })
  refundableRemaining!: number;
  @ApiProperty() additionalChargeDue!: number;
  @ApiProperty() actualRefundTotal!: number;
}

export class RentalOrderActivityLogOutDto {
  @ApiProperty() id!: string;
  @ApiProperty() action!: string;
  @ApiProperty() entity!: string;
  @ApiProperty({ type: Object }) changes!: unknown;
  @ApiPropertyOptional({ nullable: true }) note!: string | null;
  @ApiPropertyOptional({ nullable: true }) actorId!: string | null;
  @ApiPropertyOptional({ type: Object, nullable: true }) actorSnapshot!: unknown;
  @ApiProperty() createdAt!: Date;
}

export class RentalOrderOutDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty({ enum: OrderSource }) source!: OrderSource;
  @ApiProperty({ enum: OrderStatus }) status!: OrderStatus;
  @ApiProperty({ enum: HandoverStatus }) handoverStatus!: HandoverStatus;
  @ApiProperty({ enum: ReturnStatus }) returnStatus!: ReturnStatus;
  @ApiProperty({ enum: RentalSettlementStatus }) settlementStatus!: RentalSettlementStatus;
  @ApiProperty() isOverdue!: boolean;
  @ApiProperty() overdueHours!: number;
  @ApiProperty() customerId!: string;
  @ApiProperty({ type: RentalOrderCustomerSnapshotOutDto }) customerSnapshot!: RentalOrderCustomerSnapshotOutDto;
  @ApiProperty({ type: Object }) settingsSnapshot!: unknown;
  @ApiProperty({ type: Object }) rentalPeriod!: { startDate: Date; endDate: Date; actualPickupDate: Date | null; actualReturnDate: Date | null };
  @ApiProperty({ type: Object }) fulfillment!: { pickupMethod: PickupMethod; deliveryAddress: string | null };
  @ApiProperty({ type: RentalOrderFinancialsOutDto }) financials!: RentalOrderFinancialsOutDto;
  @ApiProperty({ type: Object }) notes!: { customerNote: string | null; internalNote: string | null; cancelReason: string | null };
  @ApiProperty({ type: [RentalOrderLineOutDto] }) lines!: RentalOrderLineOutDto[];
  @ApiProperty({ type: [RentalOrderChargeOutDto] }) charges!: RentalOrderChargeOutDto[];
  @ApiProperty({ type: [RentalOrderPaymentOutDto] }) payments!: RentalOrderPaymentOutDto[];
  @ApiProperty({ type: [RentalOrderRefundOutDto] }) refunds!: RentalOrderRefundOutDto[];
  @ApiProperty({ type: [RentalInspectionOutDto] }) inspections!: RentalInspectionOutDto[];
  @ApiProperty({ type: [Object] }) statusHistories!: unknown[];
  @ApiProperty({ type: [RentalOrderActivityLogOutDto] }) activityLogs!: RentalOrderActivityLogOutDto[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ nullable: true }) deletedAt!: Date | null;
}

export class RentalOrderListItemOutDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty({ enum: OrderSource }) source!: OrderSource;
  @ApiProperty({ enum: PickupMethod }) pickupMethod!: PickupMethod;
  @ApiProperty({ enum: OrderStatus }) status!: OrderStatus;
  @ApiProperty({ enum: HandoverStatus }) handoverStatus!: HandoverStatus;
  @ApiProperty({ enum: ReturnStatus }) returnStatus!: ReturnStatus;
  @ApiProperty({ enum: RentalSettlementStatus }) settlementStatus!: RentalSettlementStatus;
  @ApiProperty() isOverdue!: boolean;
  @ApiProperty() overdueHours!: number;
  @ApiProperty({ type: RentalOrderCustomerSnapshotOutDto }) customerSnapshot!: RentalOrderCustomerSnapshotOutDto;
  @ApiProperty() startDate!: Date;
  @ApiProperty() endDate!: Date;
  @ApiProperty() rentalFeeTotal!: number;
  @ApiProperty() deliveryFeeTotal!: number;
  @ApiProperty() bookingHoldTotal!: number;
  @ApiProperty() securityDepositTotal!: number;
  @ApiProperty() totalCustomerObligation!: number;
  @ApiProperty() paidTotal!: number;
  @ApiProperty() amountDueBeforeHandover!: number;
  @ApiProperty() refundDue!: number;
  @ApiProperty({ description: 'Tổng tiền đã xác nhận hoàn thực tế cho khách.' })
  actualRefundTotal!: number;
  @ApiProperty() pendingRefundTotal!: number;
  @ApiProperty() refundableRemaining!: number;
  @ApiProperty() additionalChargeDue!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
