import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsString } from 'class-validator';
import { StoreClosureType } from '@generated/prisma/enums';
import { INVALID_DATE, INVALID_ENUM, INVALID_STRING } from '@/libs/constants/invalid.constant';

export class UpdateStoreClosureDto {
  @ApiPropertyOptional({ example: '2026-06-10T00:00:00.000Z' })
  @Type(() => Date)
  @IsOptional()
  @IsDate({ message: INVALID_DATE })
  startDate?: Date;

  @ApiPropertyOptional({ example: '2026-06-10T23:59:59.000Z' })
  @Type(() => Date)
  @IsOptional()
  @IsDate({ message: INVALID_DATE })
  endDate?: Date;

  @ApiPropertyOptional({ enum: Object.values(StoreClosureType), example: StoreClosureType.MAINTENANCE })
  @IsOptional()
  @IsIn(Object.values(StoreClosureType), { message: INVALID_ENUM(Object.values(StoreClosureType), 'type') })
  type?: StoreClosureType;

  @ApiPropertyOptional({ example: 'Bao tri shop' })
  @IsOptional()
  @IsString({ message: INVALID_STRING })
  reason?: string;
}
