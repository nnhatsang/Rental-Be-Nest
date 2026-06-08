import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { INVALID_STRING } from '@/libs/constants/invalid.constant';

export class ResetUserPasswordDto {
  @ApiProperty({ example: 'NewPassword123!', minLength: 8 })
  @IsString({ message: INVALID_STRING })
  @Matches(/^(?=.*[a-z\d])(?=.*[A-Z\d])(?=.*\d)(?=.*[@$!%*?&><])[A-Za-z\d@$!%*?&><]{8,32}$/, {
    message: 'Mat khau moi phai chua chu thuong, chu hoa, chu so va ky tu dac biet',
  })
  newPassword!: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString({ message: INVALID_STRING })
  confirmPassword!: string;
}
