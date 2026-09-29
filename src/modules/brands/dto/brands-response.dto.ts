import { ApiProperty } from '@nestjs/swagger';
import { ApiPag, ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { BrandOutDto } from './brand-out.dto';

export class BrandResponseDto extends ApiRes<BrandOutDto> {
  @ApiProperty({ type: BrandOutDto })
  declare data: BrandOutDto;
}

export class BrandsPaginatedDataDto extends ApiPag<BrandOutDto> {
  @ApiProperty({ type: [BrandOutDto] })
  declare items: BrandOutDto[];
}

export class BrandsPaginatedResponseDto extends ApiPaginatedResponseDto<BrandOutDto> {
  @ApiProperty({ type: BrandsPaginatedDataDto })
  declare data: BrandsPaginatedDataDto;
}

export class DeleteBrandsDataDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

export class DeleteBrandsResponseDto extends ApiRes<DeleteBrandsDataDto> {
  @ApiProperty({ type: DeleteBrandsDataDto })
  declare data: DeleteBrandsDataDto;
}
