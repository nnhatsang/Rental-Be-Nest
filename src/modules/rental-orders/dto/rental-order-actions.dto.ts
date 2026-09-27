import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PaymentMethod,
  RentalAccessoryStatus,
  RentalInspectionCondition,
  RentalIncidentType,
  PaymentTransactionStatus,
} from '@generated/prisma/enums';
import { INVALID_ARRAY, INVALID_DATE, INVALID_ENUM, INVALID_NUMBER, INVALID_STRING, INVALID_UUID } from '@/libs/constants/invalid.constant';

export class CancelRentalOrderDto {
  @ApiProperty({ example: 'Khach huy lich' })
  @IsString({ message: INVALID_STRING })
  @IsNotEmpty({ message: INVALID_STRING })
  reason!: string;

  @ApiPropertyOptional({ default: false, description: 'Cho phép tạo yêu cầu hoàn tiền theo chính sách hủy đơn.' })
  @IsOptional()
  @IsBoolean()
  allowRefund?: boolean;

  /** @deprecated Dùng allowRefund cho client mới. */
  @ApiPropertyOptional({ default: false, deprecated: true })
  @IsOptional()
  @IsBoolean()
  refundBookingHold?: boolean;

  @ApiPropertyOptional({ example: 50000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  refundAmount?: number;

  @ApiPropertyOptional({ example: 'Da thong bao cho khach' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export class HandoverRentalOrderDto {
  @ApiPropertyOptional({ example: '2026-09-25T08:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  actualPickupDate?: Date;

  @ApiPropertyOptional({ example: 'Giao du may va phu kien' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export class ReturnRentalOrderDto {
  @ApiPropertyOptional({ example: '2026-09-27T18:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  actualReturnDate?: Date;

  @ApiPropertyOptional({ example: 'Khach tra dung han' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export class RecordRentalOrderPaymentDto {
  @ApiProperty({ example: 500000, minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: Object.values(PaymentMethod) })
  @IsEnum(PaymentMethod, { message: INVALID_ENUM(Object.values(PaymentMethod), 'method') })
  method!: PaymentMethod;

  @ApiPropertyOptional({ enum: Object.values(PaymentTransactionStatus), default: PaymentTransactionStatus.PENDING })
  @IsOptional()
  @IsEnum(PaymentTransactionStatus)
  status?: PaymentTransactionStatus;

  @ApiPropertyOptional({ example: 'BANK-FT-001' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  referenceCode?: string;

  @ApiPropertyOptional({ example: 'Khach chuyen khoan tien coc' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;

  @ApiPropertyOptional({ example: 'payment-client-request-001' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  idempotencyKey?: string;
}

export class CreateRefundDto {
  @ApiProperty({ example: 300000, minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: Object.values(PaymentMethod) })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({ example: 'REFUND-001' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  referenceCode?: string;

  @ApiPropertyOptional({ example: 'Hoan coc sau khi kiem tra may' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export class InspectionAccessoryDto {
  @ApiProperty()
  @IsString({ message: INVALID_STRING })
  name!: string;

  @ApiProperty({ example: 1, minimum: 0 })
  @Type(() => Number)
  @IsInt({ message: INVALID_NUMBER })
  @Min(0)
  expectedQuantity!: number;

  @ApiProperty({ example: 1, minimum: 0 })
  @Type(() => Number)
  @IsInt({ message: INVALID_NUMBER })
  @Min(0)
  actualQuantity!: number;

  @ApiProperty({ enum: Object.values(RentalAccessoryStatus) })
  @IsEnum(RentalAccessoryStatus)
  status!: RentalAccessoryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export class InspectionItemDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('7', { message: INVALID_UUID })
  allocationId!: string;

  @ApiProperty({ enum: Object.values(RentalInspectionCondition) })
  @IsEnum(RentalInspectionCondition)
  condition!: RentalInspectionCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;

  @ApiPropertyOptional({ type: [InspectionAccessoryDto] })
  @IsOptional()
  @IsArray({ message: INVALID_ARRAY })
  @ValidateNested({ each: true })
  @Type(() => InspectionAccessoryDto)
  accessories?: InspectionAccessoryDto[];
}

export class InspectRentalOrderDto {
  @ApiProperty({ type: [InspectionItemDto] })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InspectionItemDto)
  items!: InspectionItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export class SettleRentalOrderDto {
  @ApiPropertyOptional({ example: 'Da thu du tien phi phat sinh va hoan coc' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export class RejectPaymentDto {
  @ApiPropertyOptional({ example: 'Chuyen khoan khong hop le' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export { RentalIncidentType };
