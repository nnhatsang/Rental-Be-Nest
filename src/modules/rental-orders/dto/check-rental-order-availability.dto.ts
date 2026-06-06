import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDate, ValidateNested } from 'class-validator';
import { RentalOrderItemInDto } from './create-rental-order.dto';
import { INVALID_ARRAY, INVALID_DATE } from '@/libs/constants/invalid.constant';

export class CheckRentalOrderAvailabilityDto {
  @ApiProperty({ example: '2026-06-10T07:00:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  startDate!: Date;

  @ApiProperty({ example: '2026-06-10T09:00:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  endDate!: Date;

  @ApiProperty({ type: [RentalOrderItemInDto] })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RentalOrderItemInDto)
  items!: RentalOrderItemInDto[];
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
