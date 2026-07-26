import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RentalOrderAvailabilityService } from '../rental-orders/services/rental-order-availability.service';
import {
  AvailabilityAssetsOutDto,
  AvailabilityProductsOutDto,
  AvailabilityTimelineOutDto,
  GetAvailabilityProductAssetsDto,
  GetAvailabilityProductsDto,
  GetAvailabilityTimelineDto,
} from '../rental-orders/dto/get-rental-order-availability.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { ApiRes } from '@/libs/types/custom-response.type';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: RentalOrderAvailabilityService) {}

  @Get('products')
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({ summary: 'Xem sản phẩm còn trống theo khoảng thời gian' })
  @ApiOkResponse({ type: AvailabilityProductsOutDto })
  async getProducts(@Query() dto: GetAvailabilityProductsDto) {
    return new ApiRes(await this.availabilityService.getAvailabilityProducts(dto), 'Lấy sản phẩm khả dụng thành công');
  }

  @Get('products/:productId/assets')
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({ summary: 'Xem serial/máy của sản phẩm theo trạng thái khả dụng' })
  @ApiOkResponse({ type: AvailabilityAssetsOutDto })
  async getProductAssets(@Param('productId', IdValidatePipe) productId: string, @Query() dto: GetAvailabilityProductAssetsDto) {
    return new ApiRes(await this.availabilityService.getAvailabilityAssets({ ...dto, productId }), 'Lấy thiết bị khả dụng thành công');
  }

  @Get('timeline')
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({ summary: 'Xem lịch thuê theo từng serial dạng timeline' })
  @ApiOkResponse({ type: AvailabilityTimelineOutDto })
  async getTimeline(@Query() dto: GetAvailabilityTimelineDto) {
    return new ApiRes(await this.availabilityService.getAvailabilityTimeline(dto), 'Lấy timeline khả dụng thành công');
  }
}