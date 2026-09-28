import { ApiProperty } from '@nestjs/swagger';

export class RentalOrderUnavailableItemDto {
  @ApiProperty({ type: String, format: 'uuid' })
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty({ example: 2 })
  requestedQuantity!: number;

  @ApiProperty({ example: 1 })
  availableQuantity!: number;

  @ApiProperty({ example: 'NOT_ENOUGH_ASSETS_AVAILABLE' })
  reasonCode!: string;

  @ApiProperty({ example: 'Chỉ còn 1 máy trống trong khoảng thời gian đã chọn' })
  message!: string;
}
