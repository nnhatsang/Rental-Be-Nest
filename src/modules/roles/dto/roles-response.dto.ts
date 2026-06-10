import { ApiProperty } from '@nestjs/swagger';
import { ApiPag, ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { RoleOutDto } from './role-out.dto';

export class RoleResponseDto extends ApiRes<RoleOutDto> {
  @ApiProperty({ type: RoleOutDto })
  declare data: RoleOutDto;
}

export class RolesPaginatedDataDto extends ApiPag<RoleOutDto> {
  @ApiProperty({ type: [RoleOutDto] })
  declare items: RoleOutDto[];
}

export class RolesPaginatedResponseDto extends ApiPaginatedResponseDto<RoleOutDto> {
  @ApiProperty({ type: RolesPaginatedDataDto })
  declare data: RolesPaginatedDataDto;
}

export class RoleActionDataDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

export class RoleActionResponseDto extends ApiRes<RoleActionDataDto> {
  @ApiProperty({ type: RoleActionDataDto })
  declare data: RoleActionDataDto;
}
