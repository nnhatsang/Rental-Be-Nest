import { ApiProperty } from '@nestjs/swagger';

export class SystemSettingsOutDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '50000' })
  bookingHoldPricePerUnit!: string;

  @ApiProperty({ example: 60 })
  bookingBufferTimeMinutes!: number;

  @ApiProperty({ example: 30 })
  maxRentalTimeDays!: number;

  @ApiProperty({ example: 6 })
  maxLateReturnTimeHours!: number;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;
}
