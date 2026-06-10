import { ApiProperty } from '@nestjs/swagger';
import { ApiRes } from '@/libs/types/custom-response.type';
import { PermissionOutDto } from './permission-out.dto';

export class PermissionsResponseDto extends ApiRes<PermissionOutDto[]> {
  @ApiProperty({ type: [PermissionOutDto] })
  declare data: PermissionOutDto[];
}
