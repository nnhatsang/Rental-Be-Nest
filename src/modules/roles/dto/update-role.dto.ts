import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsOptional, IsString, Matches } from 'class-validator';
import { INVALID_ARRAY, INVALID_MATCH, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'POSTMAN_OPERATOR' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  @Matches(/^[A-Z][A-Z0-9_]{1,49}$/, { message: INVALID_MATCH('UPPER_SNAKE_CASE', 'code') })
  code?: string;

  @ApiPropertyOptional({ example: 'Postman Operator Updated' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  name?: string;

  @ApiPropertyOptional({ example: 'Updated role description' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['orders.read', 'orders.create'] })
  @IsOptional()
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @IsString({ each: true, message: INVALID_STRING })
  permissionCodes?: string[];
}

