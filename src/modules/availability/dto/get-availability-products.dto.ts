import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { INVALID_DATE, INVALID_UUID } from '@/libs/constants/invalid.constant';
import { ApiPagReq, Pagination } from '@/libs/types/custom-response.type';

export enum AvailabilityFilter {
  ALL = 'ALL',
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
}

export class GetAvailabilityProductsDto extends ApiPagReq {
  @ApiProperty({ example: '2026-09-25T08:00:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  startDate!: Date;

  @ApiProperty({ example: '2026-09-27T18:00:00.000Z' })
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

export class AvailabilityProductPriceTierOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty()
  minDays!: number;

  @ApiProperty({ nullable: true })
  maxDays!: number | null;

  @ApiProperty()
  dailyPrice!: number;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty()
  sortOrder!: number;
}

export class AvailabilityProductInventoryOutDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  reserved!: number;

  @ApiProperty()
  available!: number;
}

export class AvailabilityProductOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  productId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  dailyPrice!: number;

  @ApiProperty()
  halfDayPrice!: number;

  @ApiProperty({ nullable: true })
  hourlyOveragePrice!: number | null;

  @ApiProperty({ type: [AvailabilityProductPriceTierOutDto] })
  rentalPriceTiers!: AvailabilityProductPriceTierOutDto[];

  @ApiProperty()
  depositAmount!: number;

  @ApiProperty({ type: AvailabilityProductInventoryOutDto })
  inventory!: AvailabilityProductInventoryOutDto;
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
}
