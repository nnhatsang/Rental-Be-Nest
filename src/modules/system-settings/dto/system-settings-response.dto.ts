import { ApiProperty } from '@nestjs/swagger';
import { ApiRes } from '@/libs/types/custom-response.type';
import { SystemSettingsOutDto } from './system-settings-out.dto';

export class SystemSettingsResponseDto extends ApiRes<SystemSettingsOutDto> {
  @ApiProperty({ type: SystemSettingsOutDto })
  declare data: SystemSettingsOutDto;
}
