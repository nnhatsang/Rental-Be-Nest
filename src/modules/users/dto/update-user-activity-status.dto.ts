import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { EUserActivityStatus } from '@/libs/constants/error.constants';

export class UpdateUserActivityStatusDto {
  @ApiProperty({ enum: Object.values(EUserActivityStatus) })
  @IsIn(Object.values(EUserActivityStatus))
  activityStatus!: EUserActivityStatus;
}
