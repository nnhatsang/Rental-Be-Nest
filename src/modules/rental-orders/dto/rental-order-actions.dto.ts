import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { CollateralType, PaymentKind, PaymentMethod, PaymentRecordStatus } from '@generated/prisma/enums';
import { INVALID_DATE, INVALID_NUMBER, INVALID_STRING } from '@/libs/constants/invalid.constant';

export enum RentalOrderLateFeePolicy {
  CHARGE = 'CHARGE',
  WAIVE = 'WAIVE',
  CUSTOM = 'CUSTOM',
}

export class RentalOrderNoteDto {
  @ApiPropertyOptional({ example: 'Da goi xac nhan voi khach' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export class CancelRentalOrderDto {
  @ApiProperty({ example: 'Khach huy lich' })
  @IsString({ message: INVALID_STRING })
  cancelReason!: string;

  @ApiPropertyOptional({ example: false, description: 'Hoan tien dat lich neu shop tu choi don' })
  @IsOptional()
  @IsBoolean()
  refundBookingHold?: boolean;

  @ApiPropertyOptional({ example: 50000, description: 'So tien hoan lai cho khach khi huy don.' })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  refundAmount?: number;

  @ApiPropertyOptional({ example: false, description: 'Giu tien da thu thanh phi phat huy lich.' })
  @IsOptional()
  @IsBoolean()
  keepPaidAmountAsPenalty?: boolean;

  @ApiPropertyOptional({ example: 'Khach bao huy truoc gio nhan may' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export class ReturnRentalOrderDto {
  @ApiPropertyOptional({ example: '2026-06-10T09:30:00.000Z' })
  @Type(() => Date)
  @IsOptional()
  @IsDate({ message: INVALID_DATE })
  actualReturnDate?: Date;

  @ApiPropertyOptional({ example: 'Khach tra tre 30 phut' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export class StartRentalOrderDto extends RentalOrderNoteDto {
  @ApiPropertyOptional({ example: '2026-06-10T09:30:00.000Z' })
  @Type(() => Date)
  @IsOptional()
  @IsDate({ message: INVALID_DATE })
  actualPickupDate?: Date;
}

export class HandoverRentalOrderPaymentDto {
  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ example: 1750000 })
  @Type(() => Number)
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 'CASH-001' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  referenceCode?: string;

  @ApiPropertyOptional({ example: 'Khach thanh toan luc nhan may' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export class HandoverRentalOrderDto extends RentalOrderNoteDto {
  @ApiPropertyOptional({ example: '2026-06-10T09:30:00.000Z' })
  @Type(() => Date)
  @IsOptional()
  @IsDate({ message: INVALID_DATE })
  actualPickupDate?: Date;

  @ApiPropertyOptional({ example: 'Giu CCCD ban goc' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  collateralDescription?: string;

  @ApiPropertyOptional({ enum: CollateralType, example: CollateralType.IDENTITY_CARD, default: CollateralType.NONE })
  @IsOptional()
  @IsEnum(CollateralType)
  collateralType?: CollateralType;

  @ApiPropertyOptional({ example: 50000, description: 'Tong tien giam gia sau cung cua don tai thoi diem ban giao' })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  discountTotal?: number;

  @ApiPropertyOptional({ type: HandoverRentalOrderPaymentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => HandoverRentalOrderPaymentDto)
  payment?: HandoverRentalOrderPaymentDto;
}

export class CompleteRentalOrderSettlementPaymentDto {
  @ApiProperty({ enum: [PaymentKind.ADDITIONAL_CHARGE, PaymentKind.REFUND], example: PaymentKind.REFUND })
  @IsIn([PaymentKind.ADDITIONAL_CHARGE, PaymentKind.REFUND])
  kind!: Extract<PaymentKind, 'ADDITIONAL_CHARGE' | 'REFUND'>;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ example: 600000 })
  @Type(() => Number)
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 'SETTLE-001' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  referenceCode?: string;

  @ApiPropertyOptional({ example: 'Hoan coc sau khi tru phi' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export class CompleteRentalOrderDto extends RentalOrderNoteDto {
  @ApiPropertyOptional({ example: '2026-06-10T09:30:00.000Z' })
  @Type(() => Date)
  @IsOptional()
  @IsDate({ message: INVALID_DATE })
  actualReturnDate?: Date;

  @ApiPropertyOptional({ example: 200000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  damageFeeTotal?: number;

  @ApiPropertyOptional({ example: 'Tray filter lens' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  damageNote?: string;

  @ApiPropertyOptional({ example: 500000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  compensationFeeTotal?: number;

  @ApiPropertyOptional({ example: 'Mat lens Sony 35mm, tinh phi den bu' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  compensationNote?: string;

  @ApiPropertyOptional({ enum: RentalOrderLateFeePolicy, default: RentalOrderLateFeePolicy.CHARGE })
  @IsOptional()
  @IsEnum(RentalOrderLateFeePolicy)
  lateFeePolicy?: RentalOrderLateFeePolicy;

  @ApiPropertyOptional({ example: 100000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  customLateFeeTotal?: number;

  @ApiPropertyOptional({ example: 'Khach quen, shop ho tro mien phi tre han' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  lateFeeNote?: string;

  @ApiPropertyOptional({ type: CompleteRentalOrderSettlementPaymentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CompleteRentalOrderSettlementPaymentDto)
  settlementPayment?: CompleteRentalOrderSettlementPaymentDto;
}

export class RecordRentalOrderPaymentDto {
  @ApiProperty({ enum: PaymentKind, example: PaymentKind.BOOKING_HOLD })
  @IsEnum(PaymentKind)
  kind!: PaymentKind;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.BANK_TRANSFER })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentRecordStatus, default: PaymentRecordStatus.SUCCESS })
  @IsOptional()
  @IsEnum(PaymentRecordStatus)
  status?: PaymentRecordStatus;

  @ApiProperty({ example: 500000 })
  @Type(() => Number)
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 'BANK-FT-001' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  referenceCode?: string;

  @ApiPropertyOptional({ example: 'Khach chuyen khoan tien coc' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}

export class RefundRentalOrderPaymentDto {
  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.BANK_TRANSFER })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentRecordStatus, default: PaymentRecordStatus.SUCCESS })
  @IsOptional()
  @IsEnum(PaymentRecordStatus)
  status?: PaymentRecordStatus;

  @ApiProperty({ example: 300000 })
  @Type(() => Number)
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 'REFUND-001' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  referenceCode?: string;

  @ApiPropertyOptional({ example: 'Hoan tien coc sau khi tru tien thue' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  note?: string;
}
