import { ApiProperty } from '@nestjs/swagger';
import { ApiPag, ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { RentalOrderListItemOutDto, RentalOrderOutDto, RentalOrderQuoteOutDto } from './rental-order-out.dto';

export class RentalOrderResponseDto extends ApiRes<RentalOrderOutDto> {
  @ApiProperty({ type: RentalOrderOutDto })
  declare data: RentalOrderOutDto;
}

export class RentalOrderQuoteResponseDto extends ApiRes<RentalOrderQuoteOutDto> {
  @ApiProperty({ type: RentalOrderQuoteOutDto })
  declare data: RentalOrderQuoteOutDto;
}

export class RentalOrdersPaginatedDataDto extends ApiPag<RentalOrderListItemOutDto> {
  @ApiProperty({ type: [RentalOrderListItemOutDto] })
  declare items: RentalOrderListItemOutDto[];
}

export class RentalOrdersPaginatedResponseDto extends ApiPaginatedResponseDto<RentalOrderListItemOutDto> {
  @ApiProperty({ type: RentalOrdersPaginatedDataDto })
  declare data: RentalOrdersPaginatedDataDto;
}

export class DeleteRentalOrderDataDto {
  @ApiProperty() success!: boolean;
}

export class DeleteRentalOrderResponseDto extends ApiRes<DeleteRentalOrderDataDto> {
  @ApiProperty({ type: DeleteRentalOrderDataDto })
  declare data: DeleteRentalOrderDataDto;
}
