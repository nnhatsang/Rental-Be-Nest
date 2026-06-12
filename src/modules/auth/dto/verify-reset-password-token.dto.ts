import { INVALID_REQUIRED, INVALID_STRING } from '@/libs/constants/invalid.constant';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyResetPasswordTokenDto {
  @ApiProperty({
    example: 'u1vRjY3FQxwY6qPjvSpgWzqT_7Q2qN8V3xGzOQk6r2U',
    description: 'Raw reset token from password reset email link',
  })
  @IsNotEmpty({ message: INVALID_REQUIRED })
  @IsString({ message: INVALID_STRING })
  token!: string;
}
