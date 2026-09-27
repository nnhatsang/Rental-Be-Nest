import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDate, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { PickupMethod } from '@generated/prisma/enums';
import { INVALID_ARRAY, INVALID_DATE, INVALID_NUMBER, INVALID_STRING, INVALID_UUID } from '@/libs/constants/invalid.constant';

export class RentalOrderItemDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('7', { message: INVALID_UUID })
  productId!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: INVALID_NUMBER })
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ example: 'Body + pin + sac' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export class CreateRentalQuoteDto {
  @ApiPropertyOptional({ type: String, format: 'uuid', description: 'Required for the admin channel.' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  customerId?: string;

  @ApiProperty({ example: '2026-09-25T08:00:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  startDate!: Date;

  @ApiProperty({ example: '2026-09-27T18:00:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  endDate!: Date;

  @ApiProperty({ enum: Object.values(PickupMethod) })
  @IsEnum(PickupMethod)
  pickupMethod!: PickupMethod;

  @ApiPropertyOptional({ example: '123 Nguyen Trai, Quan 1, TP.HCM' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  deliveryAddress?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', description: 'Existing order excluded when re-quoting an order update.' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  excludeOrderId?: string;

  @ApiProperty({ type: [RentalOrderItemDto] })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RentalOrderItemDto)
  items!: RentalOrderItemDto[];
}

export class CreateRentalOrderDto {
  @ApiProperty({ type: String, format: 'uuid', description: 'Quote returned by POST /rental-orders/quote.' })
  @IsUUID('7', { message: INVALID_UUID })
  quoteId!: string;

  @ApiPropertyOptional({ example: 'Khach se den lay may luc 8h' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;

  @ApiPropertyOptional({ example: 'Kiem tra pin truoc khi ban giao' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  internalNote?: string;
}
