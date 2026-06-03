import { ApiProperty } from '@nestjs/swagger';
import { ApiRes } from '@/libs/types/custom-response.type';
import { AuthUserOutDto } from './login.dto';

export class LoginDataDto {
  @ApiProperty({ type: AuthUserOutDto })
  user!: AuthUserOutDto;
}

export class LoginResponseDto extends ApiRes<LoginDataDto> {
  @ApiProperty({ type: LoginDataDto })
  declare data: LoginDataDto;
}

export class SuccessDataDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

export class SuccessResponseDto extends ApiRes<SuccessDataDto> {
  @ApiProperty({ type: SuccessDataDto })
  declare data: SuccessDataDto;
}

export class MeResponseDto extends ApiRes<AuthUserOutDto> {
  @ApiProperty({ type: AuthUserOutDto })
  declare data: AuthUserOutDto;
}
