import { ApiProperty } from '@nestjs/swagger';
import { ApiPag, ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { RentalOrderOutDto } from './rental-order-out.dto';
import { RentalOrderAvailabilityOutDto } from './check-rental-order-availability.dto';

export class RentalOrderResponseDto extends ApiRes<RentalOrderOutDto> {
  @ApiProperty({ type: RentalOrderOutDto })
  declare data: RentalOrderOutDto;
}

export class RentalOrdersPaginatedDataDto extends ApiPag<RentalOrderOutDto> {
  @ApiProperty({ type: [RentalOrderOutDto] })
  declare items: RentalOrderOutDto[];
}

export class RentalOrdersPaginatedResponseDto extends ApiPaginatedResponseDto<RentalOrderOutDto> {
  @ApiProperty({ type: RentalOrdersPaginatedDataDto })
  declare data: RentalOrdersPaginatedDataDto;
}

export class RentalOrderAvailabilityResponseDto extends ApiRes<RentalOrderAvailabilityOutDto> {
  @ApiProperty({ type: RentalOrderAvailabilityOutDto })
  declare data: RentalOrderAvailabilityOutDto;
}

export class DeleteRentalOrderDataDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

export class DeleteRentalOrderResponseDto extends ApiRes<DeleteRentalOrderDataDto> {
  @ApiProperty({ type: DeleteRentalOrderDataDto })
  declare data: DeleteRentalOrderDataDto;
}
