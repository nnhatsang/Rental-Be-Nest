import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { INVALID_BOOLEAN } from '@/libs/constants/invalid.constant';

export class UpdateCategoryStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean({ message: INVALID_BOOLEAN })
  isActive!: boolean;
}
