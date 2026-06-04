import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdateUserRolesDto {
  @ApiProperty({ type: [String], example: ['STAFF'] })
  @IsArray()
  @IsString({ each: true })
  roleCodes!: string[];
}
