import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsOptional, IsString, Matches } from 'class-validator';
import { INVALID_ARRAY, INVALID_MATCH, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class CreateRoleDto {
  @ApiProperty({ example: 'POSTMAN_OPERATOR' })
  @IsString({ message: INVALID_STRING })
  @Matches(/^[A-Z][A-Z0-9_]{1,49}$/, { message: INVALID_MATCH('UPPER_SNAKE_CASE', 'code') })
  code!: string;

  @ApiProperty({ example: 'Postman Operator' })
  @IsString({ message: INVALID_STRING })
  name!: string;

  @ApiPropertyOptional({ example: 'Can operate rental orders from admin dashboard' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  description?: string;

  @ApiProperty({ type: [String], example: ['orders.read', 'orders.create'] })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @IsString({ each: true, message: INVALID_STRING })
  permissionCodes!: string[];
}
