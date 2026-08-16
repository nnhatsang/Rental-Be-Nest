import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { INVALID_NUMBER } from '@/libs/constants/invalid.constant';

export class UpdateSystemSettingsDto {
  @ApiPropertyOptional({ example: 50000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  bookingHoldPricePerUnit?: number;

  @ApiPropertyOptional({ example: 60 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  bookingBufferTimeMinutes?: number;

  @ApiPropertyOptional({ example: 30 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(1)
  maxRentalTimeDays?: number;

  @ApiPropertyOptional({ example: 6 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  maxLateReturnTimeHours?: number;
}
