import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { ProductRentalPriceTierInDto } from './product-rental-price-tier.dto';
import { INVALID_ARRAY, INVALID_BOOLEAN, INVALID_NUMBER, INVALID_STRING, INVALID_UUID } from '@/libs/constants/invalid.constant';

export class CreateProductDto {
  @ApiProperty({ example: 'Sony A7 IV' })
  @IsString({ message: INVALID_STRING })
  name!: string;

  @ApiProperty({ example: 'SONY-A7-IV' })
  @IsString({ message: INVALID_STRING })
  sku!: string;

  @ApiPropertyOptional({ example: 'Full-frame mirrorless camera body' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  description?: string;

  @ApiPropertyOptional({ example: 'Body, battery, charger, strap, memory card' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  includedAccessories?: string;

  @ApiPropertyOptional({ example: 'Check battery and format card before handover' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  usageGuide?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  categoryId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  brandId?: string;

  @ApiProperty({ example: 500000 })
  @Type(() => Number)
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  dailyPrice!: number;

  @ApiPropertyOptional({ example: 300000 })
  @Type(() => Number)
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  halfDayPrice!: number;

  @ApiPropertyOptional({ example: 100000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  hourlyOveragePrice!: number;

  @ApiPropertyOptional({ type: [ProductRentalPriceTierInDto] })
  @IsOptional()
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductRentalPriceTierInDto)
  rentalPriceTiers?: ProductRentalPriceTierInDto[];

  @ApiProperty({ example: 5000000 })
  @Type(() => Number)
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  depositAmount!: number;

  @ApiPropertyOptional({ example: 45000000 })
  @Type(() => Number)
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  replacementValue!: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean({ message: INVALID_BOOLEAN })
  isActive?: boolean;
}
