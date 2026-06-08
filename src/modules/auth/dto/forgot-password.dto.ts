import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { INVALID_EMAIL } from '@/libs/constants/invalid.constant';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@rental.local' })
  @IsEmail({}, { message: INVALID_EMAIL })
  email!: string;
}
