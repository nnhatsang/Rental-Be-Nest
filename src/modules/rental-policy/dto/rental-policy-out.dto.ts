import { ApiProperty } from '@nestjs/swagger';

export class RentalPolicyOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'DEFAULT' })
  code!: string;

  @ApiProperty({ example: 'Default Rental Policy' })
  name!: string;

  @ApiProperty({ example: '50000' })
  bookingHoldAmountPerUnit!: string;

  @ApiProperty({ example: 60 })
  turnaroundMinutes!: number;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;
}
