import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';
import { ApiPagReq } from '@/libs/types/custom-response.type';
import { INVALID_DATE } from '@/libs/constants/invalid.constant';

export class GetPaymentReviewQueueDto extends ApiPagReq {
  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  fromDate?: Date;

  @ApiPropertyOptional({ example: '2026-10-31T23:59:59.999Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: INVALID_DATE })
  toDate?: Date;
}
