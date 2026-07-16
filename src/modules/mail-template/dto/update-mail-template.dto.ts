import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, ArrayUnique } from 'class-validator';
import { INVALID_ARRAY, INVALID_BOOLEAN, INVALID_STRING, INVALID_UUID } from '@/libs/constants/invalid.constant';

export class UpdateMailTemplateDto {
  @ApiPropertyOptional({ example: 'Reset password' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  name?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  layoutId?: string | null;

  @ApiPropertyOptional({ example: 'Dat lai mat khau {{appName}}' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  subject?: string;

  @ApiPropertyOptional({ example: '<p>Xin chao {{userName}}</p>' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  htmlBody?: string;

  @ApiPropertyOptional({ example: 'Xin chao {{userName}}' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['userName', 'resetPasswordUrl', 'appName'] })
  @IsOptional()
  @IsArray({ message: INVALID_ARRAY })
  @ArrayUnique()
  @IsString({ each: true, message: INVALID_STRING })
  variables?: string[];

  @ApiPropertyOptional({ example: true })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean({ message: INVALID_BOOLEAN })
  isActive?: boolean;
}
