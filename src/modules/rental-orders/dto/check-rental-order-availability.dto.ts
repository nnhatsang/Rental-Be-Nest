import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, ArrayUnique, IsArray, IsDate, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { INVALID_ARRAY, INVALID_DATE, INVALID_NUMBER, INVALID_UUID } from '@/libs/constants/invalid.constant';

export class CheckRentalOrderAvailabilityItemDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('7', { message: INVALID_UUID })
  productId!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: INVALID_NUMBER })
  @Min(1, { message: 'Số lượng phải tối thiểu 1' })
  quantity!: number;

  @ApiProperty({ type: [String], format: 'uuid', example: ['0190f9ff-8a88-7000-8000-000000000001'] })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('7', { each: true, message: INVALID_UUID })
  assetUnitIds!: string[];
}

export class CheckRentalOrderAvailabilityDto {
  @ApiProperty({ example: '2026-06-10T07:00:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  startDate!: Date;

  @ApiProperty({ example: '2026-06-10T09:00:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  endDate!: Date;

  @ApiProperty({ type: String, format: 'uuid', required: false })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  excludeOrderId?: string;

  @ApiProperty({ type: [CheckRentalOrderAvailabilityItemDto] })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckRentalOrderAvailabilityItemDto)
  items!: CheckRentalOrderAvailabilityItemDto[];
}

export class RentalOrderUnavailableItemDto {
  @ApiProperty({ type: String, format: 'uuid' })
  productId!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  assetUnitId!: string | null;

  @ApiProperty({ example: 'Asset unit is already booked in this time range' })
  reason!: string;
}

export class RentalOrderAvailabilityOutDto {
  @ApiProperty({ example: true })
  isAvailable!: boolean;

  @ApiProperty({ type: Date, format: 'date-time' })
  startDate!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  endDate!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  blockedEndDate!: Date;

  @ApiProperty({ example: 60 })
  turnaroundMinutes!: number;

  @ApiProperty({ type: [RentalOrderUnavailableItemDto] })
  unavailableItems!: RentalOrderUnavailableItemDto[];
}
