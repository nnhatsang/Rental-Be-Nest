import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { INVALID_STRING } from '@/libs/constants/invalid.constant';

export class GetAllPermissionsDto {
  @ApiPropertyOptional({ example: 'orders' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  module?: string;

  @ApiPropertyOptional({ example: 'read' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  search?: string;
}
