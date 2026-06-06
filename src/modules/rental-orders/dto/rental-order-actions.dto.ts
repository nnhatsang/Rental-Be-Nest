import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDate, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { INVALID_ARRAY, INVALID_DATE, INVALID_STRING, INVALID_UUID } from '@/libs/constants/invalid.constant';

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

export class AssignRentalOrderAssetItemDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('4', { message: INVALID_UUID })
  itemId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('4', { message: INVALID_UUID })
  assetUnitId!: string;
}

export class AssignRentalOrderAssetsDto {
  @ApiProperty({ type: [AssignRentalOrderAssetItemDto] })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AssignRentalOrderAssetItemDto)
  items!: AssignRentalOrderAssetItemDto[];
}
