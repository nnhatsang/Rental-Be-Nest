import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { INVALID_STRING } from '@/libs/constants/invalid.constant';
import { ApiPagReq } from '@/libs/types/custom-response.type';

export class GetAllPermissionsDto extends PickType(ApiPagReq, ['search'] as const) {
  @ApiPropertyOptional({ example: 'orders' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  module?: string;

  @ApiPropertyOptional({ example: 'read' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  search?: string;
}
