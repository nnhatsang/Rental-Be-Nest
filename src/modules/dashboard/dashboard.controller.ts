import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { RequirePermissions } from '@/modules/auth/decorators/require-permissions.decorator';
import { DashboardService } from './dashboard.service';
import { GetDashboardAttentionQueryDto, GetDashboardOperationsDto, GetDashboardTrendsDto } from './dto/get-dashboard.dto';
import {
  DashboardAttentionPaginatedResponseDto,
  DashboardOperationsOverviewOutDto,
  DashboardTrendsOutDto,
} from './dto/dashboard-out.dto';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('operations/overview')
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({
    summary: 'Lấy tổng quan vận hành dashboard',
    description: 'Tổng hợp đơn thuê, tài chính snapshot, tình trạng thiết bị, sản phẩm thuê nhiều và các việc cần xử lý.',
  })
  @ApiOkResponse({ type: DashboardOperationsOverviewOutDto })
  async getOperationsOverview(@Query() dto: GetDashboardOperationsDto) {
    return new ApiRes(await this.dashboardService.getOperationsOverview(dto), 'Lấy tổng quan vận hành thành công');
  }

  @Get('operations/attention')
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({
    summary: 'Lấy danh sách việc cần xử lý',
    description: 'Danh sách phân trang các đơn đang cần thao tác như thanh toán, bàn giao, trả máy, hoàn tiền hoặc tranh chấp.',
  })
  @ApiOkResponse({ type: DashboardAttentionPaginatedResponseDto })
  async getAttention(@Query() query: GetDashboardAttentionQueryDto) {
    return new ApiPaginatedResponseDto(await this.dashboardService.getAttention(query), 'Lấy danh sách việc cần xử lý thành công');
  }

  @Get('operations/trends')
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({
    summary: 'Lấy xu hướng vận hành dashboard',
    description: 'Tổng hợp theo ngày, tuần hoặc tháng dựa trên ngày bắt đầu thuê. Đây là số liệu vận hành, chưa phải sổ kế toán dòng tiền.',
  })
  @ApiOkResponse({ type: DashboardTrendsOutDto })
  async getTrends(@Query() dto: GetDashboardTrendsDto) {
    return new ApiRes(await this.dashboardService.getTrends(dto), 'Lấy xu hướng vận hành thành công');
  }
}

