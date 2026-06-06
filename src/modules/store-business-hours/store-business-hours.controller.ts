import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StoreBusinessHoursService } from './store-business-hours.service';
import { UpdateStoreBusinessHoursDto } from './dto/update-store-business-hours.dto';
import { StoreBusinessHoursResponseDto } from './dto/store-business-hours-response.dto';
import { ApiRes } from '@/libs/types/custom-response.type';
import { SUCCESS } from '@/libs/constants/response.constant';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';

@ApiTags('store-business-hours')
@Controller('store-business-hours')
export class StoreBusinessHoursController {
  constructor(private readonly storeBusinessHoursService: StoreBusinessHoursService) {}

  @Get()
  @RequirePermissions(PermissionCode.SettingsRead)
  @ApiOperation({
    summary: 'Trả về danh sách giờ hoạt động của shop trong tuần',
    description: 'Trả về 7 cấu hình giờ mở của shop theo thứ trong tuần. dayOfWeek: 0 = Chu nhat, 1 = Thu hai, ..., 6 = Thu bay.',
  })
  @ApiOkResponse({ type: StoreBusinessHoursResponseDto })
  async getStoreBusinessHours() {
    return new ApiRes(await this.storeBusinessHoursService.getStoreBusinessHours(), SUCCESS);
  }

  @Put()
  @RequirePermissions(PermissionCode.SettingsUpdate)
  @ApiOperation({
    summary: 'Cập nhật cấu hình giờ hoạt động của shop',
    description: 'Cập nhật toàn bộ 7 ngày trong tuần. dayOfWeek: 0 = Chủ nhật, 1 = Thứ hai, ..., 6 = Thứ bảy.',
  })
  @ApiOkResponse({ type: StoreBusinessHoursResponseDto })
  async updateStoreBusinessHours(@Body() dto: UpdateStoreBusinessHoursDto) {
    return new ApiRes(await this.storeBusinessHoursService.updateStoreBusinessHours(dto), SUCCESS);
  }
}
