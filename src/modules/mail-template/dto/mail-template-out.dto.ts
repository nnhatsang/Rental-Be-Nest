import { ApiProperty } from '@nestjs/swagger';

export class MailTemplateOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'auth.reset_password' })
  key!: string;

  @ApiProperty({ example: 'Reset password' })
  name!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  layoutId!: string | null;

  @ApiProperty({ example: 'Default layout', nullable: true })
  layoutName!: string | null;

  @ApiProperty({ example: 'Dat lai mat khau {{appName}}' })
  subject!: string;

  @ApiProperty({ example: '<p>Xin chao {{userName}}</p>' })
  htmlBody!: string;

  @ApiProperty({ example: 'Email dat lai mat khau', nullable: true })
  description!: string | null;

  @ApiProperty({ type: [String], example: ['userName', 'resetPasswordUrl', 'appName'] })
  variables!: string[];

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  createdBy!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;
}

export class RenderedMailTemplateOutDto {
  @ApiProperty({ example: 'Dat lai mat khau Rental Admin' })
  subject!: string;

  @ApiProperty({ example: '<p>Xin chao Nguyen Van A</p>' })
  htmlBody!: string;
}

export class SendTestMailTemplateOutDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'PENDING' })
  status!: string;

  @ApiProperty({ example: null, nullable: true })
  error!: string | null;

  @ApiProperty({ example: '0190f6a4-7d10-7000-8000-000000000001' })
  jobId!: string;
}
