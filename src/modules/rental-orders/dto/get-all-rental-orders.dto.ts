import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { OrderSource, OrderStatus, PaymentStatus, PickupMethod, RefundStatus } from '@generated/prisma/enums';
import { ApiPagReq } from '@/libs/types/custom-response.type';
import { INVALID_DATE, INVALID_ENUM, INVALID_UUID } from '@/libs/constants/invalid.constant';

export enum RentalOrderSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  CODE = 'code',
  START_DATE = 'startDate',
  END_DATE = 'endDate',
  STATUS = 'status',
  PAYMENT_STATUS = 'paymentStatus',
  REFUND_STATUS = 'refundStatus',
  SOURCE = 'source',
  PICKUP_METHOD = 'pickupMethod',
  RENTAL_FEE_TOTAL = 'rentalFeeTotal',
}

export const RENTAL_ORDER_FILTER_STATUSES = [
  OrderStatus.CREATED,
  OrderStatus.CONFIRMED,
  OrderStatus.RENTING,
  OrderStatus.RETURNED,
  OrderStatus.DONE,
  OrderStatus.CANCELLED,
  OrderStatus.DISPUTED,
] satisfies OrderStatus[];

export class GetAllRentalOrdersDto extends ApiPagReq {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  customerId?: string;

  @ApiPropertyOptional({ enum: RENTAL_ORDER_FILTER_STATUSES })
  @IsOptional()
  @IsIn(RENTAL_ORDER_FILTER_STATUSES, { message: INVALID_ENUM(RENTAL_ORDER_FILTER_STATUSES, 'status') })
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: Object.values(PaymentStatus) })
  @IsOptional()
  @IsIn(Object.values(PaymentStatus), { message: INVALID_ENUM(Object.values(PaymentStatus), 'paymentStatus') })
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ enum: Object.values(RefundStatus) })
  @IsOptional()
  @IsIn(Object.values(RefundStatus), { message: INVALID_ENUM(Object.values(RefundStatus), 'refundStatus') })
  refundStatus?: RefundStatus;

  @ApiPropertyOptional({ enum: Object.values(OrderSource) })
  @IsOptional()
  @IsIn(Object.values(OrderSource), { message: INVALID_ENUM(Object.values(OrderSource), 'source') })
  source?: OrderSource;

  @ApiPropertyOptional({ enum: Object.values(PickupMethod) })
  @IsOptional()
  @IsIn(Object.values(PickupMethod), { message: INVALID_ENUM(Object.values(PickupMethod), 'pickupMethod') })
  pickupMethod?: PickupMethod;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsOptional()
  @IsDate({ message: INVALID_DATE })
  fromDate?: Date;

  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.000Z' })
  @Type(() => Date)
  @IsOptional()
  @IsDate({ message: INVALID_DATE })
  toDate?: Date;

  @ApiPropertyOptional({
    enum: RentalOrderSortBy,
    default: RentalOrderSortBy.CREATED_AT,
  })
  @IsEnum(RentalOrderSortBy)
  @IsOptional()
  sortBy: RentalOrderSortBy = RentalOrderSortBy.CREATED_AT;
}
