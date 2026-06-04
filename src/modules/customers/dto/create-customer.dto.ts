import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';
import { INVALID_EMAIL, INVALID_PHONE_NUMBER, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString({ message: INVALID_STRING })
  name!: string;

  @ApiPropertyOptional({ example: '0900000000' })
  @IsOptional()
  @Matches(/^(?:\+84|0)(3[2-9]|5[6|8|9]|7[0|6-9]|8[1-9]|9[0-9]|2[0-9]{1,2})[0-9]{7}$/, {
    message: INVALID_PHONE_NUMBER,
  })
  phone?: string;

  @ApiPropertyOptional({ example: 'nguyenvana@example.com' })
  @IsOptional()
  @IsEmail({}, { message: INVALID_EMAIL })
  email?: string;

  @ApiPropertyOptional({ example: '123 Nguyen Trai, Quan 1, TP.HCM' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  address?: string;

  @ApiPropertyOptional({ example: '079000000001' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  identityNumber?: string;

  @ApiPropertyOptional({ example: 'zalo.me/0900000000' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  socialContact?: string;

  @ApiPropertyOptional({ example: 'Khach quen' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  notes?: string;
}
