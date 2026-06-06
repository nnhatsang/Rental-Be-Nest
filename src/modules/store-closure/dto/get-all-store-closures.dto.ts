import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional } from 'class-validator';
import { StoreClosureType } from '@generated/prisma/enums';
import { ApiPagReq } from '@/libs/types/custom-response.type';
import { INVALID_DATE, INVALID_ENUM } from '@/libs/constants/invalid.constant';

export class GetAllStoreClosuresDto extends ApiPagReq {
  @ApiPropertyOptional({ enum: Object.values(StoreClosureType) })
  @IsOptional()
  @IsIn(Object.values(StoreClosureType), { message: INVALID_ENUM(Object.values(StoreClosureType), 'type') })
  type?: StoreClosureType;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsOptional()
  @IsDate({ message: INVALID_DATE })
  fromDate?: Date;

  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.000Z' })
  @Type(() => Date)
  @IsOptional()
  @IsDate({ message: INVALID_DATE })
  toDate?: Date;
}
