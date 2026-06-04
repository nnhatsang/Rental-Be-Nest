import { ApiProperty } from '@nestjs/swagger';
import { ApiPag, ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { ProductOutDto } from './product-out.dto';

export class ProductResponseDto extends ApiRes<ProductOutDto> {
  @ApiProperty({ type: ProductOutDto })
  declare data: ProductOutDto;
}

export class ProductsPaginatedDataDto extends ApiPag<ProductOutDto> {
  @ApiProperty({ type: [ProductOutDto] })
  declare items: ProductOutDto[];
}

export class ProductsPaginatedResponseDto extends ApiPaginatedResponseDto<ProductOutDto> {
  @ApiProperty({ type: ProductsPaginatedDataDto })
  declare data: ProductsPaginatedDataDto;
}

export class DeleteProductDataDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

export class DeleteProductResponseDto extends ApiRes<DeleteProductDataDto> {
  @ApiProperty({ type: DeleteProductDataDto })
  declare data: DeleteProductDataDto;
}
