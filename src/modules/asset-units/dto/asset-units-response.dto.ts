import { ApiProperty } from '@nestjs/swagger';
import { ApiPag, ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { AssetUnitOutDto } from './asset-unit-out.dto';

export class AssetUnitResponseDto extends ApiRes<AssetUnitOutDto> {
  @ApiProperty({ type: AssetUnitOutDto })
  declare data: AssetUnitOutDto;
}

export class AssetUnitsPaginatedDataDto extends ApiPag<AssetUnitOutDto> {
  @ApiProperty({ type: [AssetUnitOutDto] })
  declare items: AssetUnitOutDto[];
}

export class AssetUnitsPaginatedResponseDto extends ApiPaginatedResponseDto<AssetUnitOutDto> {
  @ApiProperty({ type: AssetUnitsPaginatedDataDto })
  declare data: AssetUnitsPaginatedDataDto;
}

export class DeleteAssetUnitDataDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

export class DeleteAssetUnitResponseDto extends ApiRes<DeleteAssetUnitDataDto> {
  @ApiProperty({ type: DeleteAssetUnitDataDto })
  declare data: DeleteAssetUnitDataDto;
}
