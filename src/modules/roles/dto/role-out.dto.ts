import { ApiProperty } from '@nestjs/swagger';

export class PermissionInRoleOutDto {
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
}

export class UserInRoleOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'staff@rental.local' })
  email!: string;

  @ApiProperty({ example: 'Staff User' })
  fullName!: string;
}

export class RoleOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'STAFF' })
  code!: string;

  @ApiProperty({ example: 'Staff' })
  name!: string;

  @ApiProperty({ example: 'Operate rental orders', nullable: true })
  description!: string | null;

  @ApiProperty({ example: false })
  isSystem!: boolean;

  @ApiProperty({ type: [PermissionInRoleOutDto] })
  permissions!: PermissionInRoleOutDto[];

  @ApiProperty({ example: 3 })
  usersCount!: number;

  @ApiProperty({ type: [UserInRoleOutDto], required: false })
  users?: UserInRoleOutDto[];

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;
}
