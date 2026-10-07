import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

import { INVALID_STRING, INVALID_UUID } from '@/libs/constants/invalid.constant';

export class MailTemplateDraftDto {
  @ApiPropertyOptional({ example: 'Đặt lại mật khẩu {{appName}}' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  subject?: string;

  @ApiPropertyOptional({ example: '<p>Xin chào {{userName}}</p>' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  htmlBody?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  layoutId?: string | null;
}
