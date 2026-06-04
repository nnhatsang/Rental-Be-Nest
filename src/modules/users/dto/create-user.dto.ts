import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { INVALID_EMAIL, INVALID_MIN, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class CreateUserDto {
  @ApiProperty({ example: 'staff@rental.local' })
  @IsEmail({}, { message: INVALID_EMAIL })
  email!: string;

  @ApiProperty({ example: 'Staff User' })
  @IsString({ message: INVALID_STRING })
  fullName!: string;

  @ApiPropertyOptional({ example: '0900000000' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  phone?: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString({ message: INVALID_STRING })
  @MinLength(8, { message: INVALID_MIN(8, 'Mật khẩu') })
  password!: string;

  @ApiPropertyOptional({ type: [String], example: ['STAFF'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];
}
