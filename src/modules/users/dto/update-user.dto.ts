import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { INVALID_EMAIL, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Staff User' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  fullName?: string;

  @ApiPropertyOptional({ example: '0900000000' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  phone?: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsEmail({}, { message: INVALID_EMAIL })
  email?: string;
}
