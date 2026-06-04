import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';
import { INVALID_STRING } from '@/libs/constants/invalid.constant';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Password123!' })
  @IsString({ message: INVALID_STRING })
  oldPassword!: string;

  @ApiProperty({ example: 'NewPassword123!', minLength: 8 })
  @IsString({ message: INVALID_STRING })
  // @MinLength(8)
  @Matches(/^(?=.*[a-z\d])(?=.*[A-Z\d])(?=.*\d)(?=.*[@$!%*?&><])[A-Za-z\d@$!%*?&><]{8,32}$/, {
    message: 'Mật khẩu mới phải chứa các kí tự in thường, in hoa, chữ số và kí tự đặc biệt!',
  })
  newPassword!: string;
}
