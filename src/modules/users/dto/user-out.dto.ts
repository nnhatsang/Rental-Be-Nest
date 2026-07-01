import { ApiProperty } from '@nestjs/swagger';
import { EUserActivityStatus } from '@/libs/constants/error.constants';

export class UserRoleOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ADMIN' })
  code!: string;

  @ApiProperty({ example: 'Administrator' })
  name!: string;
}

export class UserOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'admin@rental.local' })
  email!: string;

  @ApiProperty({ example: 'System Admin' })
  fullName!: string;

  @ApiProperty({ example: '0900000000', nullable: true })
  phone!: string | null;

  @ApiProperty({ enum: Object.values(EUserActivityStatus) })
  activityStatus!: EUserActivityStatus;

  @ApiProperty({ type: [UserRoleOutDto] })
  roles!: UserRoleOutDto[];

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time', nullable: true })
  deletedAt!: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  createdBy!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  updatedBy!: string | null;

}
