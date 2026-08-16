import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiRes } from '@/libs/types/custom-response.type';
import { SUCCESS } from '@/libs/constants/response.constant';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { SystemSettingsService } from './system-settings.service';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';
import { SystemSettingsResponseDto } from './dto/system-settings-response.dto';

@ApiTags('system-settings')
@Controller('system-settings')
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get()
  @RequirePermissions(PermissionCode.SettingsRead)
  @ApiOperation({
    summary: 'Get system settings',
    description: 'Returns global rental settings.',
  })
  @ApiOkResponse({ type: SystemSettingsResponseDto })
  async getSystemSettings() {
    return new ApiRes(await this.systemSettingsService.getSystemSettings(), SUCCESS);
  }

  @Patch()
  @RequirePermissions(PermissionCode.SettingsUpdate)
  @ApiOperation({
    summary: 'Update system settings',
    description: 'Updates global rental settings.',
  })
  @ApiOkResponse({ type: SystemSettingsResponseDto })
  async updateSystemSettings(@Body() dto: UpdateSystemSettingsDto) {
    return new ApiRes(await this.systemSettingsService.updateSystemSettings(dto), SUCCESS);
  }
}
