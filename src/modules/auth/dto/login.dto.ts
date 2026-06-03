import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

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
}

export class AuthUserOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'admin@rental.local' })
  email!: string;

  @ApiProperty({ example: 'System Admin' })
  fullName!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  sessionId!: string;

  @ApiProperty({ type: [String], example: ['ADMIN'] })
  roles!: string[];

  @ApiProperty({
    type: [String],
    example: ['orders.read', 'orders.create'],
  })
  permissions!: string[];
}
