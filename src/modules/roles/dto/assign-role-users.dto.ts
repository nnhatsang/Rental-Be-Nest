import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';
import { INVALID_ARRAY, INVALID_UUID } from '@/libs/constants/invalid.constant';

export class AssignRoleUsersDto {
  @ApiProperty({ type: String, format: 'uuid', example: 'b119b4d0-00ec-4d26-b289-b27f4440d89e' })
  @IsUUID('7', { message: INVALID_UUID })
  roleId!: string;

  @ApiProperty({ type: [String], format: 'uuid', example: ['b119b4d0-00ec-4d26-b289-b27f4440d89e'] })
  @IsArray({ message: INVALID_ARRAY })
  @IsUUID('7', { each: true, message: INVALID_UUID })
  userIds!: string[];
}
