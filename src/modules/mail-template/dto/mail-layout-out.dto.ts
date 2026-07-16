import { ApiProperty } from '@nestjs/swagger';

export class MailLayoutOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'default' })
  key!: string;

  @ApiProperty({ example: 'Default email layout' })
  name!: string;

  @ApiProperty({ example: '<html><body>{{content}}</body></html>' })
  htmlLayout!: string;

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
