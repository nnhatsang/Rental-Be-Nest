import { ApiProperty } from '@nestjs/swagger';
import { StoreClosureType } from '@generated/prisma/enums';

export class StoreClosureOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: Date, format: 'date-time' })
  startDate!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  endDate!: Date;

  @ApiProperty({ enum: Object.values(StoreClosureType), example: StoreClosureType.OFF })
  type!: StoreClosureType;

  @ApiProperty({ example: 'Nghi le', nullable: true })
  reason!: string | null;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time', nullable: true })
  deletedAt!: Date | null;
}
