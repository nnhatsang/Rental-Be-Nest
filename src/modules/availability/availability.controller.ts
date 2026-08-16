import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RentalOrderAvailabilityService } from '../rental-orders/services/rental-order-availability.service';
import { CheckRentalOrderAvailabilityDto } from '../rental-orders/dto/check-rental-order-availability.dto';
import {
  AvailabilityAssetsOutDto,
  AvailabilityProductsOutDto,
  AvailabilityTimelineOutDto,
  GetAvailabilityAssetsDto,
  GetAvailabilityProductAssetsDto,
  GetAvailabilityProductsDto,
  GetAvailabilityTimelineDto,
} from '../rental-orders/dto/get-rental-order-availability.dto';
import { RentalOrderAvailabilityResponseDto } from '../rental-orders/dto/rental-orders-response.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { ApiRes } from '@/libs/types/custom-response.type';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: RentalOrderAvailabilityService) {}

  @Post('check')
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({ summary: 'Kiem tra danh sach serial co kha dung trong khoang thoi gian' })
  @ApiOkResponse({ type: RentalOrderAvailabilityResponseDto })
  async checkAvailability(@Body() dto: CheckRentalOrderAvailabilityDto) {
    return new ApiRes(await this.availabilityService.checkRentalOrderAvailability(dto), 'Kiem tra lich thue thanh cong');
  }

  @Get('products')
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({ summary: 'Xem sản phẩm còn trống theo khoảng thời gian' })
  @ApiOkResponse({ type: AvailabilityProductsOutDto })
  async getProducts(@Query() dto: GetAvailabilityProductsDto) {
    return new ApiRes(await this.availabilityService.getAvailabilityProducts(dto), 'Lấy sản phẩm khả dụng thành công');
  }

  @Get('assets')
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({ summary: 'Tim serial trong hoac bi chan trong khoang thoi gian' })
  @ApiOkResponse({ type: AvailabilityAssetsOutDto })
  async getAssets(@Query() dto: GetAvailabilityAssetsDto) {
    return new ApiRes(await this.availabilityService.getAvailabilityAssets(dto), 'Lay thiet bi kha dung thanh cong');
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
