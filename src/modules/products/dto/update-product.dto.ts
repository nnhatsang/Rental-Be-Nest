import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { ProductRentalPriceTierInDto } from './product-rental-price-tier.dto';
import { INVALID_ARRAY, INVALID_BOOLEAN, INVALID_NUMBER, INVALID_STRING, INVALID_UUID } from '@/libs/constants/invalid.constant';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Sony A7 IV' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  name?: string;

  @ApiPropertyOptional({ example: 'SONY-A7-IV' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  sku?: string;

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

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4', { message: INVALID_UUID })
  categoryId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4', { message: INVALID_UUID })
  brandId?: string;

  @ApiPropertyOptional({ example: 500000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  dailyPrice?: number;

  @ApiPropertyOptional({ example: 300000, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  halfDayPrice?: number;

  @ApiPropertyOptional({ example: 100000, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  hourlyOveragePrice?: number;

  @ApiPropertyOptional({ type: [ProductRentalPriceTierInDto], description: 'Replace rental price tiers when provided.' })
  @IsOptional()
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductRentalPriceTierInDto)
  rentalPriceTiers?: ProductRentalPriceTierInDto[];

  @ApiPropertyOptional({ example: 5000000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({ example: 45000000, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  replacementValue?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: INVALID_BOOLEAN })
  isActive?: boolean;
}
