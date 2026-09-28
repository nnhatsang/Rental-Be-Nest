import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { ApiRes } from '@/libs/types/custom-response.type';
import { AvailabilityScheduleService } from './availability-schedule.service';
import { AvailabilityGanttOutDto } from './dto/availability-gantt-out.dto';
import { GetAvailabilityGanttDto } from './dto/get-availability-gantt.dto';
import { AvailabilityProductsOutDto, GetAvailabilityProductsDto } from './dto/get-availability-products.dto';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityScheduleService: AvailabilityScheduleService) {}

  @Get('gantt')
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({ summary: 'Xem lịch thuê theo nhóm sản phẩm và từng thiết bị dạng Gantt' })
  @ApiOkResponse({ type: AvailabilityGanttOutDto })
  async getGantt(@Query() dto: GetAvailabilityGanttDto) {
    return new ApiRes(await this.availabilityScheduleService.getGantt(dto), 'Lấy lịch Gantt thành công');
  }

  @Get('products')
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({ summary: 'Xem sản phẩm còn trống theo khoảng thời gian' })
  @ApiOkResponse({ type: AvailabilityProductsOutDto })
  async getProducts(@Query() dto: GetAvailabilityProductsDto) {
    return new ApiRes(await this.availabilityScheduleService.getAvailabilityProducts(dto), 'Lấy sản phẩm khả dụng thành công');
  }
}
