import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { INVALID_EMAIL, INVALID_PHONE_NUMBER, INVALID_REQUIRED, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString({ message: INVALID_STRING })
  @IsNotEmpty({ message: INVALID_REQUIRED })
  name!: string;

  @ApiProperty({ example: '0900000000' })
  @Matches(/^(?:\+84|0)(3[2-9]|5[689]|7[06789]|8[1-9]|9\d|2\d{1,2})\d{7}$/, {
    message: INVALID_PHONE_NUMBER,
  })
  phone!: string;

  @ApiProperty({ example: 'nguyenvana@example.com' })
  @IsEmail({}, { message: INVALID_EMAIL })
  email!: string;

  @ApiProperty({ example: '123 Nguyen Trai, Quan 1, TP.HCM' })
  @IsString({ message: INVALID_STRING })
  @IsNotEmpty({ message: INVALID_REQUIRED })
  address!: string;

  @ApiProperty({ example: '079000000001' })
  @IsString({ message: INVALID_STRING })
  @IsNotEmpty({ message: INVALID_REQUIRED })
  identityNumber!: string;

  @ApiProperty({ example: 'zalo.me/0900000000' })
  @IsString({ message: INVALID_STRING })
  @IsNotEmpty({ message: INVALID_REQUIRED })
  socialContact!: string;

  @ApiPropertyOptional({ example: 'Khach quen' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  notes?: string;
}
