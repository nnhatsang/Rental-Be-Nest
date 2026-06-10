import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';
import { INVALID_ARRAY, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class UpdateRolePermissionsDto {
  @ApiProperty({ type: [String], example: ['orders.read', 'orders.create'] })
  @IsArray({ message: INVALID_ARRAY })
  @ArrayMinSize(1)
  @IsString({ each: true, message: INVALID_STRING })
  permissionCodes!: string[];
}
