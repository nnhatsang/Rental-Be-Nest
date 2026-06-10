import { ApiProperty } from '@nestjs/swagger';

export class PermissionOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'orders.read' })
  code!: string;

  @ApiProperty({ example: 'Orders Read' })
  name!: string;

  @ApiProperty({ example: 'Allows orders.read', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 'orders' })
  module!: string;

  @ApiProperty({ example: 'read' })
  action!: string;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;
}
