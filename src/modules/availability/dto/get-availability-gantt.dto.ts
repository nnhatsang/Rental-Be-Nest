import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';
import { INVALID_UUID } from '@/libs/constants/invalid.constant';
import { ApiCursorReq } from '@/libs/types/custom-response.type';

export class GetAvailabilityGanttDto extends ApiCursorReq {
  @ApiProperty({ example: '2026-09-25T08:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @ApiProperty({ example: '2026-09-27T18:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7', { message: INVALID_UUID })
  productId?: string;
}
