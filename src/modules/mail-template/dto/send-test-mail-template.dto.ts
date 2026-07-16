import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsObject } from 'class-validator';
import { INVALID_EMAIL, INVALID_OBJECT } from '@/libs/constants/invalid.constant';

export class SendTestMailTemplateDto {
  @ApiProperty({ example: 'admin@rental.local' })
  @IsEmail({}, { message: INVALID_EMAIL })
  toEmail!: string;

  @ApiProperty({
    type: Object,
    example: {
      userName: 'Nguyen Van A',
      resetPasswordUrl: 'http://localhost:3001/auth/reset-password?token=sample',
      expiresInMinutes: 30,
      appName: 'Rental Admin',
    },
  })
  @IsObject({ message: INVALID_OBJECT })
  payload!: Record<string, unknown>;
}
