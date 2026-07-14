import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { INVALID_ARRAY, INVALID_ENUM, INVALID_UUID } from '@/libs/constants/invalid.constant';

export enum AssignRoleUsersOperation {
  Assign = 'ASSIGN',
  Remove = 'REMOVE',
}

export class AssignRoleUsersDto {
  @ApiProperty({ type: String, format: 'uuid', example: 'b119b4d0-00ec-4d26-b289-b27f4440d89e' })
  @IsUUID('7', { message: INVALID_UUID })
  roleId!: string;

  @ApiProperty({ type: [String], format: 'uuid', example: ['b119b4d0-00ec-4d26-b289-b27f4440d89e'] })
  @IsArray({ message: INVALID_ARRAY })
  @IsUUID('7', { each: true, message: INVALID_UUID })
  userIds!: string[];

  @ApiPropertyOptional({ enum: AssignRoleUsersOperation, default: AssignRoleUsersOperation.Assign })
  @IsEnum(AssignRoleUsersOperation, { message: INVALID_ENUM(Object.values(AssignRoleUsersOperation), 'operation') })
  @IsOptional()
  operation: AssignRoleUsersOperation = AssignRoleUsersOperation.Assign;
}
