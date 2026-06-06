import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RentalPolicyService } from './rental-policy.service';
import { UpdateRentalPolicyDto } from './dto/update-rental-policy.dto';
import { RentalPolicyResponseDto } from './dto/rental-policy-response.dto';
import { ApiRes } from '@/libs/types/custom-response.type';
import { SUCCESS } from '@/libs/constants/response.constant';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';

@ApiTags('rental-policy')
@Controller('rental-policy')
export class RentalPolicyController {
  constructor(private readonly rentalPolicyService: RentalPolicyService) {}

  @Get()
  @RequirePermissions(PermissionCode.SettingsRead)
  @ApiOperation({
    summary: 'Trả về chính sách thuê mặc định',
    description: 'Trả về cấu hình phí đặt lịch mới thiết bị và thời gian đợi giữa hai lượt thuê.',
  })
  @ApiOkResponse({ type: RentalPolicyResponseDto })
  async getRentalPolicy() {
    return new ApiRes(await this.rentalPolicyService.getRentalPolicy(), SUCCESS);
  }

  @Patch()
  @RequirePermissions(PermissionCode.SettingsUpdate)
  @ApiOperation({
    summary: 'Cập nhật chính sách thuê mặc định',
    description: 'Cập nhật phí đặt lịch mới thiết bị và thời gian đợi giữa hai lượt thuê.',
  })
  @ApiOkResponse({ type: RentalPolicyResponseDto })
  async updateRentalPolicy(@Body() dto: UpdateRentalPolicyDto) {
    return new ApiRes(await this.rentalPolicyService.updateRentalPolicy(dto), SUCCESS);
  }
}
