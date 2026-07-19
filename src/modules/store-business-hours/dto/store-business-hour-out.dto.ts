import { ApiProperty } from '@nestjs/swagger';

export class StoreBusinessHourOutDto {
  @ApiProperty({ example: 1, description: '0 = Sunday, 1 = Monday, ..., 6 = Saturday' })
  dayOfWeek!: number;

  @ApiProperty({ example: '08:00' })
  openTime!: string;

  @ApiProperty({ example: '20:00' })
  closeTime!: string;

  @ApiProperty({ example: true })
  isOpen!: boolean;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;
}
