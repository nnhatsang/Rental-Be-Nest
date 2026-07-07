import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { OrderStatus, PaymentStatus } from '@generated/prisma/enums';
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
  UPFRONT_TOTAL = 'upfrontTotal',
  REMAINING_TOTAL = 'remainingTotal',
}

export class GetAllRentalOrdersDto extends ApiPagReq {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  customerId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  assignedToId?: string;

  @ApiPropertyOptional({ enum: Object.values(OrderStatus) })
  @IsOptional()
  @IsIn(Object.values(OrderStatus), { message: INVALID_ENUM(Object.values(OrderStatus), 'status') })
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: Object.values(PaymentStatus) })
  @IsOptional()
  @IsIn(Object.values(PaymentStatus), { message: INVALID_ENUM(Object.values(PaymentStatus), 'paymentStatus') })
  paymentStatus?: PaymentStatus;

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
