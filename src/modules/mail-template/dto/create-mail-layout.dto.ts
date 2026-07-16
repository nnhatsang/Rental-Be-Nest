import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import { INVALID_BOOLEAN, INVALID_MATCH, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class CreateMailLayoutDto {
  @ApiProperty({ example: 'default' })
  @IsString({ message: INVALID_STRING })
  @Matches(/^[a-z0-9._-]+$/, { message: INVALID_MATCH('a-z0-9._-', 'key') })
  key!: string;

  @ApiProperty({ example: 'Default email layout' })
  @IsString({ message: INVALID_STRING })
  name!: string;

  @ApiProperty({ example: '<html><body>{{content}}</body></html>' })
  @IsString({ message: INVALID_STRING })
  htmlLayout!: string;

  @ApiPropertyOptional({ example: true })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean({ message: INVALID_BOOLEAN })
  isActive?: boolean;
}
