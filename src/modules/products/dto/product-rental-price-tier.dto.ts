import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { INVALID_NUMBER, INVALID_POSITIVE, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class ProductRentalPriceTierInDto {
  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(1)
  minDays!: number;

  @ApiPropertyOptional({ example: 6, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  maxDays?: number;

  @ApiProperty({ example: 180000 })
  @Type(() => Number)
  @IsNumber({}, { message: INVALID_NUMBER })
  @IsPositive({ message: INVALID_POSITIVE })
  dailyPrice!: number;

  @ApiPropertyOptional({ example: 'Combo 3-6 ngày' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  name?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  sortOrder?: number;
}

export class ProductRentalPriceTierOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 3 })
  minDays!: number;

  @ApiProperty({ example: 6, nullable: true })
  maxDays!: number | null;

  @ApiProperty({ example: '180000' })
  dailyPrice!: string;

  @ApiProperty({ example: 'Combo 3-6 ngày', nullable: true })
  name!: string | null;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time', nullable: true })
  deletedAt!: Date | null;
}
