import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { INVALID_BOOLEAN, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Máy ảnh' })
  @IsString({ message: INVALID_STRING })
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'may-anh' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  @MaxLength(160)
  slug?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean({ message: INVALID_BOOLEAN })
  isActive?: boolean;
}
