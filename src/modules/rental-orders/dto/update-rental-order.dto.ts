import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDate, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';
import { PickupMethod } from '@generated/prisma/enums';
import { INVALID_ARRAY, INVALID_DATE, INVALID_EMAIL, INVALID_PHONE_NUMBER, INVALID_REQUIRED, INVALID_STRING, INVALID_UUID } from '@/libs/constants/invalid.constant';
import { RentalOrderItemDto } from './create-rental-order.dto';

export class UpdateRentalOrderCustomerSnapshotDto {
  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString({ message: INVALID_STRING })
  @IsNotEmpty({ message: INVALID_REQUIRED })
  name!: string;

  @ApiPropertyOptional({ example: '0900000000', nullable: true })
  @IsOptional()
  @Matches(/^(?:\+84|0)(3[2-9]|5[6|8|9]|7[0|6-9]|8[1-9]|9[0-9]|2[0-9]{1,2})[0-9]{7}$/, {
    message: INVALID_PHONE_NUMBER,
  })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'nguyenvana@example.com', nullable: true })
  @IsOptional()
  @IsEmail({}, { message: INVALID_EMAIL })
  email?: string | null;

  @ApiPropertyOptional({ example: '123 Nguyen Trai, Quan 1, TP.HCM', nullable: true })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  address?: string | null;

  @ApiPropertyOptional({ example: '079000000001', nullable: true })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  identityNumber?: string | null;
}

export class UpdateRentalOrderDto {
  @ApiPropertyOptional({ type: String, format: 'uuid', description: 'A fresh quote is required when schedule/assets change.' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  quoteId?: string;

  @ApiPropertyOptional({ type: UpdateRentalOrderCustomerSnapshotDto, description: 'Updates the customer information stored on this order only.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateRentalOrderCustomerSnapshotDto)
  customerSnapshot?: UpdateRentalOrderCustomerSnapshotDto;

  @ApiPropertyOptional({ example: '2026-09-25T08:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  startDate?: Date;

  @ApiPropertyOptional({ example: '2026-09-27T18:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  endDate?: Date;

  @ApiPropertyOptional({ enum: Object.values(PickupMethod) })
  @IsOptional()
  @IsEnum(PickupMethod)
  pickupMethod?: PickupMethod;

  @ApiPropertyOptional({ example: '123 Nguyen Trai, Quan 1, TP.HCM', nullable: true })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  deliveryAddress?: string | null;

  @ApiPropertyOptional({ type: [RentalOrderItemDto] })
  @IsOptional()
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RentalOrderItemDto)
  items?: RentalOrderItemDto[];

  @ApiPropertyOptional({ example: 'Khach doi ngay nhan may' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string | null;

  @ApiPropertyOptional({ example: 'Uu tien may co serial moi' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  internalNote?: string | null;
}
