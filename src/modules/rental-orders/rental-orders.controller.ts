import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RentalOrdersService } from './rental-orders.service';
import { AssignRentalOrderAssetsDto, CancelRentalOrderDto, RentalOrderNoteDto } from './dto/rental-order-actions.dto';
import { CheckRentalOrderAvailabilityDto } from './dto/check-rental-order-availability.dto';
import { CreateRentalOrderDto } from './dto/create-rental-order.dto';
import { GetAllRentalOrdersDto } from './dto/get-all-rental-orders.dto';
import {
  DeleteRentalOrderResponseDto,
  RentalOrderAvailabilityResponseDto,
  RentalOrderResponseDto,
  RentalOrdersPaginatedResponseDto,
} from './dto/rental-orders-response.dto';
import { UpdateRentalOrderDto } from './dto/update-rental-order.dto';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { SUCCESS } from '@/libs/constants/response.constant';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { DeleteRentalOrdersDto } from './dto/delete-rental-orders.dto';

@ApiTags('rental-orders')
@Controller('rental-orders')
export class RentalOrdersController {
  constructor(private readonly rentalOrdersService: RentalOrdersService) {}

  @Post('check-availability')
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({
    summary: 'Kiểm tra khả dụng sản phẩm cho đơn thuê',
    description: 'Kiểm tra giờ mở cửa, lịch đóng cửa, sản phẩm, asset unit và đơn thuê đang block trong cùng khoảng thời gian.',
  })
  @ApiOkResponse({ type: RentalOrderAvailabilityResponseDto })
  async checkRentalOrderAvailability(@Body() dto: CheckRentalOrderAvailabilityDto) {
    return new ApiRes(await this.rentalOrdersService.checkRentalOrderAvailability(dto), 'Kiểm tra lịch thuê thành công');
  }

  @Get()
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({
    summary: 'Lấy danh sách đơn thuê',
    description: 'Trả về danh sách đơn thuê có phân trang, tìm kiếm và bộ lọc trạng thái/thời gian.',
  })
  @ApiOkResponse({ type: RentalOrdersPaginatedResponseDto })
  async getAllRentalOrders(@Query() query: GetAllRentalOrdersDto) {
    const result = await this.rentalOrdersService.getAllRentalOrders(query);

    return new ApiPaginatedResponseDto(result, SUCCESS);
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({
    summary: 'Lấy chi tiết đơn thuê',
    description: 'Trả về chi tiết đơn thuê kèm items, customer, người tạo và người được phân công.',
  })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async getRentalOrderById(@Param('id', IdValidatePipe) id: string) {
    return new ApiRes(await this.rentalOrdersService.getRentalOrderById(id), 'Lấy thông tin đơn thuê thành công');
  }

  @Post()
  @RequirePermissions(PermissionCode.OrdersCreate)
  @ApiOperation({
    summary: 'Tạo đơn thuê nháp',
    description: 'Tạo đơn thuê admin-first với trạng thái DRAFT, snapshot khách hàng/sản phẩm/chính sách và tính tổng tiền.',
  })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async createRentalOrder(@Body() dto: CreateRentalOrderDto, @CurrentUser() currentUser: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.createRentalOrder(dto, currentUser), 'Tạo đơn thuê thành công');
  }

  @Patch(':id/items/assign-assets')
  @RequirePermissions(PermissionCode.OrdersUpdate)
  @ApiOperation({
    summary: 'Gán thiết bị vật lý cho đơn thuê',
    description: 'Gán asset unit cho từng dòng đơn thuê.',
  })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async assignRentalOrderAssets(@Param('id', IdValidatePipe) id: string, @Body() dto: AssignRentalOrderAssetsDto, @CurrentUser() currentUser: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.assignRentalOrderAssets(id, dto, currentUser), 'Gán thiết bị cho đơn thuê thành công');
  }

  @Post(':id/confirm')
  @RequirePermissions(PermissionCode.OrdersUpdateStatus)
  @ApiOperation({
    summary: 'Xác nhận đơn thuê',
    description: 'Chuyển đơn từ DRAFT sang CONFIRMED sau khi kiểm tra lại availability.',
  })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async confirmRentalOrder(@Param('id', IdValidatePipe) id: string, @Body() dto: RentalOrderNoteDto, @CurrentUser() currentUser: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.confirmRentalOrder(id, dto, currentUser), 'Xác nhận đơn thuê thành công');
  }

  @Post(':id/cancel')
  @RequirePermissions(PermissionCode.OrdersCancel)
  @ApiOperation({
    summary: 'Hủy đơn thuê',
    description: 'Chuyển đơn sang CANCELLED và lưu lý do hủy.',
  })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async cancelRentalOrder(@Param('id', IdValidatePipe) id: string, @Body() dto: CancelRentalOrderDto, @CurrentUser() currentUser: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.cancelRentalOrder(id, dto, currentUser), 'Hủy đơn thuê thành công');
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.OrdersUpdate)
  @ApiOperation({
    summary: 'Cập nhật đơn thuê nháp',
    description: 'Cập nhật thông tin đơn DRAFT; nếu truyền items thì thay thế toàn bộ danh sách items.',
  })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async updateRentalOrder(@Param('id', IdValidatePipe) id: string, @Body() dto: UpdateRentalOrderDto, @CurrentUser() currentUser: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.updateRentalOrder(id, dto, currentUser), 'Cập nhật đơn thuê thành công');
  }

  @Delete()
  @RequirePermissions(PermissionCode.OrdersCancel)
  @ApiOperation({
    summary: 'Xóa mềm nhiều đơn thuê',
    description: 'Chỉ xóa mềm đơn DRAFT hoặc CANCELLED.',
  })
  @ApiOkResponse({ type: DeleteRentalOrderResponseDto })
  async deleteRentalOrders(@CurrentUser() currentUser: AuthUser, @Body() dto: DeleteRentalOrdersDto) {
    return new ApiRes(await this.rentalOrdersService.deleteRentalOrders(dto, currentUser.id), 'Xóa đơn thuê thành công');
  }
}
