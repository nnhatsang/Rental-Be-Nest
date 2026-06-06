import { ApiProperty } from '@nestjs/swagger';
import { ApiRes } from '@/libs/types/custom-response.type';
import { StoreBusinessHourOutDto } from './store-business-hour-out.dto';

export class StoreBusinessHoursResponseDto extends ApiRes<StoreBusinessHourOutDto[]> {
  @ApiProperty({ type: [StoreBusinessHourOutDto] })
  declare data: StoreBusinessHourOutDto[];
}
