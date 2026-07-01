import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { INVALID_STRING } from '@/libs/constants/invalid.constant';

export class LoginDto {
  @ApiProperty({ example: 'admin@rental.local', description: 'Email của người dùng' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Mật khẩu của người dùng',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ type: String, example: '192.168.0.1', required: false })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  ipAddress?: string;

  @ApiProperty({ type: String, example: 'Iphone 15', required: false })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  userAgent?: string;

  @ApiProperty({ type: String, example: 'Iphone 15', required: false })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  deviceId?: string;

  @ApiProperty({ type: String, example: 'abc', required: false, nullable: true })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  captchaToken?: string;

  @ApiProperty({ type: String, example: 'abc', required: false, nullable: true })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  fcmToken?: string;
}

export class AuthUserOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'admin@rental.local' })
  email!: string;

  @ApiProperty({ example: 'System Admin' })
  fullName!: string;

  @ApiProperty({ example: '0900000000', nullable: true })
  phone!: string | null;

  @ApiProperty({ type: [String], example: ['ADMIN'] })
  roles!: string[];

  @ApiProperty({
    type: [String],
    example: ['orders.read', 'orders.create'],
  })
  permissions!: string[];
}
