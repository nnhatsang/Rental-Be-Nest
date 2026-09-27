import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { OrderSource, OrderStatus, PickupMethod, RentalSettlementStatus } from '@generated/prisma/enums';
import { ApiPagReq } from '@/libs/types/custom-response.type';
import { INVALID_DATE, INVALID_STRING, INVALID_UUID } from '@/libs/constants/invalid.constant';

export enum RentalOrderSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  CODE = 'code',
  START_DATE = 'startDate',
  END_DATE = 'endDate',
  STATUS = 'status',
  SETTLEMENT_STATUS = 'settlementStatus',
}

export class GetAllRentalOrdersDto extends ApiPagReq {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  customerId?: string;

  @ApiPropertyOptional({ enum: Object.values(OrderStatus) })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: Object.values(RentalSettlementStatus) })
  @IsOptional()
  @IsEnum(RentalSettlementStatus)
  settlementStatus?: RentalSettlementStatus;

  @ApiPropertyOptional({ enum: Object.values(OrderSource) })
  @IsOptional()
  @IsEnum(OrderSource)
  source?: OrderSource;

  @ApiPropertyOptional({ enum: Object.values(PickupMethod) })
  @IsOptional()
  @IsEnum(PickupMethod)
  pickupMethod?: PickupMethod;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  fromDate?: Date;

  @ApiPropertyOptional({ example: '2026-09-30T23:59:59.999Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  toDate?: Date;

  @ApiPropertyOptional({ enum: RentalOrderSortBy, default: RentalOrderSortBy.CREATED_AT })
  @IsOptional()
  @IsEnum(RentalOrderSortBy)
  sortBy: RentalOrderSortBy = RentalOrderSortBy.CREATED_AT;
}
