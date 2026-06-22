import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { INVALID_NUMBER, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class UpdateRentalPolicyDto {
  @ApiPropertyOptional({ example: 'Default Rental Policy' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  name?: string;

  @ApiPropertyOptional({ example: 50000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  bookingHoldAmountPerUnit?: number;

  @ApiPropertyOptional({ example: 60 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(0)
  turnaroundMinutes?: number;

}
