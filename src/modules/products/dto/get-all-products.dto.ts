import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { INVALID_BOOLEAN, INVALID_STRING, INVALID_UUID } from '@/libs/constants/invalid.constant';
import { ApiPagReq } from '@/libs/types/custom-response.type';

export class GetAllProductsInDto extends ApiPagReq {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  categoryId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  brandId?: string;

  @ApiPropertyOptional({ example: true })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean({ message: INVALID_BOOLEAN })
  isActive?: boolean;
}
