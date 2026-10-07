import { ApiProperty } from '@nestjs/swagger';

export class MailTemplateVariableOutDto {
  @ApiProperty({ example: 'customerName' })
  key!: string;

  @ApiProperty({ example: 'Tên khách hàng' })
  label!: string;

  @ApiProperty({ enum: ['text', 'url', 'number'], example: 'text' })
  type!: 'text' | 'url' | 'number';

  @ApiProperty({ example: true })
  required!: boolean;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  sampleValue!: string | number;
}

export class MailTemplateCatalogOutDto {
  @ApiProperty({ example: 'auth.reset_password' })
  key!: string;

  @ApiProperty({ example: 'Đặt lại mật khẩu' })
  label!: string;

  @ApiProperty({ example: 'auth' })
  category!: string;

  @ApiProperty({ example: 'Gửi khi người dùng yêu cầu tạo lại mật khẩu.' })
  description!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  templateId!: string | null;

  @ApiProperty({ example: true })
  isConfigured!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: [MailTemplateVariableOutDto] })
  variables!: MailTemplateVariableOutDto[];

  @ApiProperty({ type: Object })
  samplePayload!: Record<string, unknown>;
}
