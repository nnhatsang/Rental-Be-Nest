import { ApiProperty } from '@nestjs/swagger';
import { CustomerStatus } from '@generated/prisma/enums';

export class CustomerOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CUS-000001', nullable: true })
  code!: string | null;

  @ApiProperty({ example: 'Nguyen Van A' })
  name!: string;

  @ApiProperty({ example: '0900000000', nullable: true })
  phone!: string | null;

  @ApiProperty({ example: 'customer@example.com', nullable: true })
  email!: string | null;

  @ApiProperty({ example: '123 Nguyen Trai, Quan 1, TP.HCM', nullable: true })
  address!: string | null;

  @ApiProperty({ example: '079000000001', nullable: true })
  identityNumber!: string | null;

  @ApiProperty({ example: 'zalo.me/0900000000', nullable: true })
  socialContact!: string | null;

  @ApiProperty({ example: 'Khach quen', nullable: true })
  notes!: string | null;

  @ApiProperty({ enum: Object.values(CustomerStatus), example: CustomerStatus.ACTIVE })
  status!: CustomerStatus;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time', nullable: true })
  deletedAt!: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  createdBy!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  updatedBy!: string | null;
}
