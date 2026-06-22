import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDate, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { PickupMethod } from '@generated/prisma/enums';
import { RentalOrderItemInDto } from './create-rental-order.dto';
import { INVALID_ARRAY, INVALID_DATE, INVALID_ENUM, INVALID_NUMBER, INVALID_STRING, INVALID_UUID } from '@/libs/constants/invalid.constant';

export class UpdateRentalOrderDto {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  customerId?: string;

  @ApiPropertyOptional({ example: '2026-06-10T07:00:00.000Z' })
  @Type(() => Date)
  @IsOptional()
  @IsDate({ message: INVALID_DATE })
  startDate?: Date;

  @ApiPropertyOptional({ example: '2026-06-10T09:00:00.000Z' })
  @Type(() => Date)
  @IsOptional()
  @IsDate({ message: INVALID_DATE })
  endDate?: Date;

  @ApiPropertyOptional({ enum: Object.values(PickupMethod), example: PickupMethod.DELIVERY })
  @IsOptional()
  @IsIn(Object.values(PickupMethod), { message: INVALID_ENUM(Object.values(PickupMethod), 'pickupMethod') })
  pickupMethod?: PickupMethod;

  @ApiPropertyOptional({ example: '123 Nguyen Trai, Quan 1, TP.HCM', nullable: true })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  deliveryAddress?: string;

  @ApiPropertyOptional({ example: 30000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  deliveryFeeTotal?: number;

  @ApiPropertyOptional({ example: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  discountTotal?: number;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  assignedToId?: string;

  @ApiPropertyOptional({ example: 'Khach doi gio nhan may' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;

  @ApiPropertyOptional({ example: 'Da goi xac nhan voi khach' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  internalNote?: string;

  @ApiPropertyOptional({ type: [RentalOrderItemInDto], description: 'Replace draft order items when provided.' })
  @IsOptional()
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RentalOrderItemInDto)
  items?: RentalOrderItemInDto[];
}
