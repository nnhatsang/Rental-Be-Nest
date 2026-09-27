import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDate, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { INVALID_ARRAY, INVALID_DATE, INVALID_NUMBER, INVALID_UUID } from '@/libs/constants/invalid.constant';

export class CheckRentalOrderAvailabilityItemDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('7', { message: INVALID_UUID })
  productId!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: INVALID_NUMBER })
  @Min(1)
  quantity!: number;
}

export class CheckRentalOrderAvailabilityDto {
  @ApiProperty({ example: '2026-09-25T08:00:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  startDate!: Date;

  @ApiProperty({ example: '2026-09-27T18:00:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  endDate!: Date;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
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

  @ApiProperty()
  productName!: string;

  @ApiProperty({ example: 2 })
  requestedQuantity!: number;

  @ApiProperty({ example: 1 })
  availableQuantity!: number;

  @ApiProperty({ example: 'NOT_ENOUGH_ASSETS_AVAILABLE' })
  reasonCode!: string;

  @ApiProperty({ example: 'Chỉ còn 1 máy trống trong khoảng thời gian đã chọn' })
  message!: string;
}

export class RentalOrderAvailabilityOutDto {
  @ApiProperty()
  isAvailable!: boolean;

  @ApiProperty({ type: Date, format: 'date-time' })
  startDate!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  endDate!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  blockedEndDate!: Date;

  @ApiProperty()
  turnaroundMinutes!: number;

  @ApiProperty({ type: [RentalOrderUnavailableItemDto] })
  unavailableItems!: RentalOrderUnavailableItemDto[];
}
