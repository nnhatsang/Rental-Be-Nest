import { ApiProperty } from '@nestjs/swagger';
import { ApiPag, ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { UserOutDto } from './user-out.dto';

export class UserResponseDto extends ApiRes<UserOutDto> {
  @ApiProperty({ type: UserOutDto })
  declare data: UserOutDto;
}

export class UsersPaginatedDataDto extends ApiPag<UserOutDto> {
  @ApiProperty({ type: [UserOutDto] })
  declare items: UserOutDto[];
}

export class UsersPaginatedResponseDto extends ApiPaginatedResponseDto<UserOutDto> {
  @ApiProperty({ type: UsersPaginatedDataDto })
  declare data: UsersPaginatedDataDto;
}

export class DeleteUserDataDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

export class DeleteUserResponseDto extends ApiRes<DeleteUserDataDto> {
  @ApiProperty({ type: DeleteUserDataDto })
  declare data: DeleteUserDataDto;
}

export class SuccessUserActionResponseDto extends ApiRes<DeleteUserDataDto> {
  @ApiProperty({ type: DeleteUserDataDto })
  declare data: DeleteUserDataDto;
}
