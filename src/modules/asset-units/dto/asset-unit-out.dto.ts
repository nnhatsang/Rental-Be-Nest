import { ApiProperty } from '@nestjs/swagger';
import { AssetCondition, AssetStatus } from '@generated/prisma/enums';

export class AssetUnitProductOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Sony A7 IV' })
  name!: string;

  @ApiProperty({ example: 'SONY-A7-IV' })
  sku!: string;
}

export class AssetUnitOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: AssetUnitProductOutDto })
  product!: AssetUnitProductOutDto;

  @ApiProperty({ example: 'SN-A7IV-001', nullable: true })
  serialNumber!: string | null;

  @ApiProperty({ enum: Object.values(AssetStatus), example: AssetStatus.AVAILABLE })
  status!: AssetStatus;

  @ApiProperty({ enum: Object.values(AssetCondition), example: AssetCondition.GOOD })
  condition!: AssetCondition;

  @ApiProperty({ example: 'Includes body cap and cage', nullable: true })
  note!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

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
