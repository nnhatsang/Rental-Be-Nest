import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDate, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { PickupMethod } from '@generated/prisma/enums';
import { INVALID_ARRAY, INVALID_DATE, INVALID_ENUM, INVALID_NUMBER, INVALID_STRING, INVALID_UUID } from '@/libs/constants/invalid.constant';

export class RentalOrderItemInDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('7', { message: INVALID_UUID })
  productId!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', description: 'Physical asset unit if admin assigns serial at create time.' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  assetUnitId?: string;

  @ApiPropertyOptional({ example: 'Body + 1 battery + charger' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export class CreateRentalOrderDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('7', { message: INVALID_UUID })
  customerId!: string;

  @ApiProperty({ example: '2026-06-10T07:00:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  startDate!: Date;

  @ApiProperty({ example: '2026-06-10T09:00:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  endDate!: Date;

  @ApiPropertyOptional({ enum: Object.values(PickupMethod), example: PickupMethod.PICKUP_AT_STORE })
  @IsOptional()
  @IsIn(Object.values(PickupMethod), { message: INVALID_ENUM(Object.values(PickupMethod), 'pickupMethod') })
  pickupMethod?: PickupMethod;

  @ApiPropertyOptional({ example: '123 Nguyen Trai, Quan 1, TP.HCM' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  deliveryAddress?: string;

  @ApiPropertyOptional({ example: 30000, default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  deliveryFeeTotal?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  discountTotal?: number;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  assignedToId?: string;

  @ApiPropertyOptional({ example: 'Khach se den lay luc 7h' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;

  @ApiPropertyOptional({ example: 'Can kiem tra pin truoc khi giao' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  internalNote?: string;

  @ApiProperty({ type: [RentalOrderItemInDto] })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RentalOrderItemInDto)
  items!: RentalOrderItemInDto[];
}
