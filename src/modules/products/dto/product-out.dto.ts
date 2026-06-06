import { ApiProperty } from '@nestjs/swagger';
import { ProductRentalPriceTierOutDto } from './product-rental-price-tier.dto';

export class ProductRelationOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Sony' })
  name!: string;
}

export class ProductOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Sony A7 IV' })
  name!: string;

  @ApiProperty({ example: 'SONY-A7-IV' })
  sku!: string;

  @ApiProperty({ example: 'Full-frame mirrorless camera body', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 'Body, battery, charger, strap, memory card', nullable: true })
  includedAccessories!: string | null;

  @ApiProperty({ example: 'Check battery and format card before handover', nullable: true })
  usageGuide!: string | null;

  @ApiProperty({ type: ProductRelationOutDto, nullable: true })
  category!: ProductRelationOutDto | null;

  @ApiProperty({ type: ProductRelationOutDto, nullable: true })
  brand!: ProductRelationOutDto | null;

  @ApiProperty({ example: '500000' })
  dailyPrice!: string;

  @ApiProperty({ example: '300000', nullable: true })
  halfDayPrice!: string | null;

  @ApiProperty({ example: '100000', nullable: true })
  hourlyOveragePrice!: string | null;

  @ApiProperty({ type: [ProductRentalPriceTierOutDto] })
  rentalPriceTiers!: ProductRentalPriceTierOutDto[];

  @ApiProperty({ example: '5000000' })
  depositAmount!: string;

  @ApiProperty({ example: '45000000', nullable: true })
  replacementValue!: string | null;

  @ApiProperty({ example: 3 })
  stockQuantity!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time', nullable: true })
  deletedAt!: Date | null;
}
