import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { INVALID_REQUIRED, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'u1vRjY3FQxwY6qPjvSpgWzqT_7Q2qN8V3xGzOQk6r2U',
    description: 'Raw reset token from password reset email link',
  })
  @IsNotEmpty({ message: INVALID_REQUIRED })
  @IsString({ message: INVALID_STRING })
  token!: string;

  @ApiProperty({ example: 'NewPassword123!', minLength: 8 })
  @IsNotEmpty({ message: INVALID_REQUIRED })
  @IsString({ message: INVALID_STRING })
  @Matches(/^(?=.*[a-z\d])(?=.*[A-Z\d])(?=.*\d)(?=.*[@$!%*?&><])[A-Za-z\d@$!%*?&><]{8,32}$/, {
    message: 'Mật khẩu mới phải chứa các kí tự in thường, in hoa, chữ số và kí tự đặc biệt!',
  })
  newPassword!: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsNotEmpty({ message: INVALID_REQUIRED })
  @IsString({ message: INVALID_STRING })
  confirmPassword!: string;
}
