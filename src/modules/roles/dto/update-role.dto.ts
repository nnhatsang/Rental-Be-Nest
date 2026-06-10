import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { INVALID_STRING } from '@/libs/constants/invalid.constant';

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Postman Operator Updated' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  name?: string;

  @ApiPropertyOptional({ example: 'Updated role description' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  description?: string;
}
