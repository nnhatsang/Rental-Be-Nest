import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { SUCCESS } from '@/libs/constants/response.constant';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { RequirePermissions } from '@/modules/auth/decorators/require-permissions.decorator';
import { AuthUser } from '@/modules/auth/types/auth-user.type';
import { CreateRentalOrderDto, CreateRentalQuoteDto } from './dto/create-rental-order.dto';
import { DeleteRentalOrdersDto } from './dto/delete-rental-orders.dto';
import { GetAllRentalOrdersDto } from './dto/get-all-rental-orders.dto';
import { CancelRentalOrderDto, CloseCancelledRentalOrderDto, CreateRefundDto, HandoverRentalOrderDto, InspectRentalOrderDto, RecordRentalOrderPaymentDto, RejectPaymentDto, ReturnRentalOrderDto, SettleRentalOrderDto } from './dto/rental-order-actions.dto';
import { DeleteRentalOrderResponseDto, RentalOrderQuoteResponseDto, RentalOrderResponseDto, RentalOrdersPaginatedResponseDto } from './dto/rental-orders-response.dto';
import { UpdateRentalOrderDto } from './dto/update-rental-order.dto';
import { RentalOrdersService } from './rental-orders.service';

@ApiTags('rental-orders')
@Controller('rental-orders')
export class RentalOrdersController {
  constructor(private readonly rentalOrdersService: RentalOrdersService) {}

  @Get()
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOkResponse({ type: RentalOrdersPaginatedResponseDto })
  async getAll(@Query() query: GetAllRentalOrdersDto) {
    return new ApiPaginatedResponseDto(await this.rentalOrdersService.getAllRentalOrders(query), SUCCESS);
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async getById(@Param('id', IdValidatePipe) id: string) {
    return new ApiRes(await this.rentalOrdersService.getRentalOrderById(id), 'Lấy chi tiết đơn thuê thành công');
  }

  @Post('quote')
  @RequirePermissions(PermissionCode.OrdersCreate)
  @ApiOperation({ summary: 'Create a server-side rental quote' })
  @ApiOkResponse({ type: RentalOrderQuoteResponseDto })
  async createQuote(@Body() dto: CreateRentalQuoteDto, @CurrentUser() user: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.createRentalQuote(dto, user), 'Tạo báo giá đơn thuê thành công');
  }

  @Post()
  @RequirePermissions(PermissionCode.OrdersCreate)
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async create(@Body() dto: CreateRentalOrderDto, @CurrentUser() user: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.createRentalOrder(dto, user), 'Tạo đơn thuê thành công');
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.OrdersUpdate)
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async update(@Param('id', IdValidatePipe) id: string, @Body() dto: UpdateRentalOrderDto, @CurrentUser() user: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.updateRentalOrder(id, dto, user), 'Cập nhật đơn thuê thành công');
  }

  @Delete()
  @RequirePermissions(PermissionCode.OrdersCancel)
  @ApiOkResponse({ type: DeleteRentalOrderResponseDto })
  async delete(@Body() dto: DeleteRentalOrdersDto, @CurrentUser() user: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.deleteRentalOrders(dto, user), 'Xóa đơn thuê thành công');
  }

  @Post(':id/cancel')
  @RequirePermissions(PermissionCode.OrdersCancel)
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async cancel(@Param('id', IdValidatePipe) id: string, @Body() dto: CancelRentalOrderDto, @CurrentUser() user: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.cancelRentalOrder(id, dto, user), 'Hủy đơn thuê thành công');
  }

  @Post(':id/payments')
  @RequirePermissions(PermissionCode.OrdersRecordPayment)
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async recordPayment(@Param('id', IdValidatePipe) id: string, @Body() dto: RecordRentalOrderPaymentDto, @CurrentUser() user: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.recordPayment(id, dto, user), 'Tạo giao dịch thanh toán thành công');
  }

  @Post(':id/payments/:paymentId/confirm')
  @RequirePermissions(PermissionCode.OrdersRecordPayment)
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async confirmPayment(@Param('id', IdValidatePipe) id: string, @Param('paymentId', IdValidatePipe) paymentId: string, @CurrentUser() user: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.confirmPayment(id, paymentId, user), 'Xác nhận thanh toán thành công');
  }

  @Post(':id/payments/:paymentId/reject')
  @RequirePermissions(PermissionCode.OrdersRecordPayment)
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async rejectPayment(
    @Param('id', IdValidatePipe) id: string,
    @Param('paymentId', IdValidatePipe) paymentId: string,
    @Body() dto: RejectPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiRes(await this.rentalOrdersService.rejectPayment(id, paymentId, dto, user), 'Từ chối thanh toán thành công');
  }

  @Post(':id/refunds')
  @RequirePermissions(PermissionCode.OrdersRefund)
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async createRefund(@Param('id', IdValidatePipe) id: string, @Body() dto: CreateRefundDto, @CurrentUser() user: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.createRefund(id, dto, user), 'Tạo yêu cầu hoàn tiền thành công');
  }

  @Post(':id/refunds/:refundId/confirm')
  @RequirePermissions(PermissionCode.OrdersRefund)
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async confirmRefund(
    @Param('id', IdValidatePipe) id: string,
    @Param('refundId', IdValidatePipe) refundId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiRes(await this.rentalOrdersService.confirmRefund(id, refundId, user), 'Xác nhận hoàn tiền thành công');
  }

  @Post(':id/close-cancellation')
  @RequirePermissions(PermissionCode.OrdersRefund)
  @ApiOperation({ summary: 'Chốt phần tiền còn lại không hoàn của đơn đã hủy' })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async closeCancellation(
    @Param('id', IdValidatePipe) id: string,
    @Body() dto: CloseCancelledRentalOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiRes(await this.rentalOrdersService.closeCancelledOrder(id, dto, user), 'Chốt tài chính đơn đã hủy thành công');
  }

  @Post(':id/handover')
  @RequirePermissions(PermissionCode.OrdersUpdateStatus)
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async handover(@Param('id', IdValidatePipe) id: string, @Body() dto: HandoverRentalOrderDto, @CurrentUser() user: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.handoverOrder(id, dto, user), 'Bàn giao đơn thuê thành công');
  }

  @Post(':id/return')
  @RequirePermissions(PermissionCode.OrdersUpdateStatus)
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async return(@Param('id', IdValidatePipe) id: string, @Body() dto: ReturnRentalOrderDto, @CurrentUser() user: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.returnOrder(id, dto, user), 'Ghi nhận trả máy thành công');
  }

  @Post(':id/inspections')
  @RequirePermissions(PermissionCode.OrdersUpdateStatus)
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async inspect(@Param('id', IdValidatePipe) id: string, @Body() dto: InspectRentalOrderDto, @CurrentUser() user: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.inspectOrder(id, dto, user), 'Lưu biên bản kiểm tra thành công');
  }

  @Post(':id/settle')
  @RequirePermissions(PermissionCode.OrdersUpdateStatus)
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async settle(@Param('id', IdValidatePipe) id: string, @Body() dto: SettleRentalOrderDto, @CurrentUser() user: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.settleOrder(id, dto, user), 'Quyết toán đơn thuê thành công');
  }
}
