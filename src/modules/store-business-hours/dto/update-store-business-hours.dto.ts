import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, Matches, Max, Min, ValidateNested } from 'class-validator';
import { INVALID_ARRAY, INVALID_BOOLEAN, INVALID_MATCH, INVALID_NUMBER } from '@/libs/constants/invalid.constant';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateStoreBusinessHourItemDto {
  @ApiProperty({ example: 1, description: '0 = Sunday, 1 = Monday, ..., 6 = Saturday' })
  @Type(() => Number)
  @IsInt({ message: INVALID_NUMBER })
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '08:00' })
  @Matches(TIME_PATTERN, { message: INVALID_MATCH('HH:mm', 'openTime') })
  openTime!: string;

  @ApiProperty({ example: '20:00' })
  @Matches(TIME_PATTERN, { message: INVALID_MATCH('HH:mm', 'closeTime') })
  closeTime!: string;

  @ApiProperty({ example: true })
  @IsBoolean({ message: INVALID_BOOLEAN })
  isOpen!: boolean;
}

export class UpdateStoreBusinessHoursDto {
  @ApiProperty({ type: [UpdateStoreBusinessHourItemDto] })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => UpdateStoreBusinessHourItemDto)
  items!: UpdateStoreBusinessHourItemDto[];
}
