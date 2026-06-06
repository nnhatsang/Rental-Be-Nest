import { ApiProperty } from '@nestjs/swagger';
import { ApiPag, ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { StoreClosureOutDto } from './store-closure-out.dto';

export class StoreClosureResponseDto extends ApiRes<StoreClosureOutDto> {
  @ApiProperty({ type: StoreClosureOutDto })
  declare data: StoreClosureOutDto;
}

export class StoreClosuresPaginatedDataDto extends ApiPag<StoreClosureOutDto> {
  @ApiProperty({ type: [StoreClosureOutDto] })
  declare items: StoreClosureOutDto[];
}

export class StoreClosuresPaginatedResponseDto extends ApiPaginatedResponseDto<StoreClosureOutDto> {
  @ApiProperty({ type: StoreClosuresPaginatedDataDto })
  declare data: StoreClosuresPaginatedDataDto;
}

export class DeleteStoreClosureDataDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

export class DeleteStoreClosureResponseDto extends ApiRes<DeleteStoreClosureDataDto> {
  @ApiProperty({ type: DeleteStoreClosureDataDto })
  declare data: DeleteStoreClosureDataDto;
}
