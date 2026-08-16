import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { SUCCESS } from '@/libs/constants/response.constant';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { CreateRentalOrderDto } from './dto/create-rental-order.dto';
import { DeleteRentalOrdersDto } from './dto/delete-rental-orders.dto';
import { GetAllRentalOrdersDto } from './dto/get-all-rental-orders.dto';
import {
  CancelRentalOrderDto,
  CompleteRentalOrderDto,
  HandoverRentalOrderDto,
  RecordRentalOrderPaymentDto,
  RefundRentalOrderPaymentDto,
  StartRentalOrderDto,
} from './dto/rental-order-actions.dto';
import { DeleteRentalOrderResponseDto, RentalOrderResponseDto, RentalOrdersPaginatedResponseDto } from './dto/rental-orders-response.dto';
import { UpdateRentalOrderDto } from './dto/update-rental-order.dto';
import { RentalOrdersService } from './rental-orders.service';
import { RentalOrderPaymentsService } from './services/rental-order-payments.service';
import { RentalOrderWorkflowService } from './services/rental-order-workflow.service';

@ApiTags('rental-orders')
@Controller('rental-orders')
export class RentalOrdersController {
  constructor(
    private readonly rentalOrdersService: RentalOrdersService,
    private readonly workflowService: RentalOrderWorkflowService,
    private readonly paymentsService: RentalOrderPaymentsService,
  ) {}

  @Get()
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({ summary: 'List rental orders' })
  @ApiOkResponse({ type: RentalOrdersPaginatedResponseDto })
  async getAllRentalOrders(@Query() query: GetAllRentalOrdersDto) {
    const result = await this.rentalOrdersService.getAllRentalOrders(query);

    return new ApiPaginatedResponseDto(result, SUCCESS);
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.OrdersRead)
  @ApiOperation({ summary: 'Get rental order detail' })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async getRentalOrderById(@Param('id', IdValidatePipe) id: string) {
    return new ApiRes(await this.rentalOrdersService.getRentalOrderById(id), 'Lây thông tin chi tiết đơn thuê thành công');
  }

  @Post()
  @RequirePermissions(PermissionCode.OrdersCreate)
  @ApiOperation({ summary: 'Create rental order with CREATED status' })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async createRentalOrder(@Body() dto: CreateRentalOrderDto, @CurrentUser() currentUser: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.createRentalOrder(dto, currentUser), 'Tao don thue thanh cong');
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.OrdersUpdate)
  @ApiOperation({ summary: 'Update CREATED rental order' })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async updateRentalOrder(@Param('id', IdValidatePipe) id: string, @Body() dto: UpdateRentalOrderDto, @CurrentUser() currentUser: AuthUser) {
    return new ApiRes(await this.rentalOrdersService.updateRentalOrder(id, dto, currentUser), 'Cap nhat don thue thanh cong');
  }

  @Delete()
  @RequirePermissions(PermissionCode.OrdersCancel)
  @ApiOperation({ summary: 'Soft delete CREATED or CANCELLED rental orders' })
  @ApiOkResponse({ type: DeleteRentalOrderResponseDto })
  async deleteRentalOrders(@CurrentUser() currentUser: AuthUser, @Body() dto: DeleteRentalOrdersDto) {
    return new ApiRes(await this.rentalOrdersService.deleteRentalOrders(dto, currentUser), 'Xoa don thue thanh cong');
  }

  @Post(':id/cancel')
  @RequirePermissions(PermissionCode.OrdersCancel)
  @ApiOperation({ summary: 'Cancel rental order' })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async cancelRentalOrder(@Param('id', IdValidatePipe) id: string, @Body() dto: CancelRentalOrderDto, @CurrentUser() currentUser: AuthUser) {
    return new ApiRes(await this.workflowService.cancelOrder(id, dto, currentUser), 'Huy don thue thanh cong');
  }

  @Post(':id/renting')
  @RequirePermissions(PermissionCode.OrdersUpdateStatus)
  @ApiOperation({ summary: 'Start rental (legacy alias of handover)' })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async markRenting(@Param('id', IdValidatePipe) id: string, @Body() dto: StartRentalOrderDto, @CurrentUser() currentUser: AuthUser) {
    return new ApiRes(await this.workflowService.markRenting(id, dto, currentUser), 'Cap nhat trang thai don thanh cong');
  }

  @Post(':id/handover')
  @RequirePermissions(PermissionCode.OrdersUpdateStatus)
  @ApiOperation({ summary: 'Handover rental order and start renting' })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async handoverOrder(@Param('id', IdValidatePipe) id: string, @Body() dto: HandoverRentalOrderDto, @CurrentUser() currentUser: AuthUser) {
    return new ApiRes(await this.workflowService.handoverOrder(id, dto, currentUser), 'Ban giao don thue thanh cong');
  }

  @Post(':id/complete')
  @RequirePermissions(PermissionCode.OrdersUpdateStatus)
  @ApiOperation({ summary: 'Complete rental order with return settlement' })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async completeOrder(@Param('id', IdValidatePipe) id: string, @Body() dto: CompleteRentalOrderDto, @CurrentUser() currentUser: AuthUser) {
    return new ApiRes(await this.workflowService.completeOrder(id, dto, currentUser), 'Hoan tat don thue thanh cong');
  }

  @Post(':id/payments')
  @RequirePermissions(PermissionCode.OrdersRecordPayment)
  @ApiOperation({ summary: 'Record rental order payment' })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async recordPayment(@Param('id', IdValidatePipe) id: string, @Body() dto: RecordRentalOrderPaymentDto, @CurrentUser() currentUser: AuthUser) {
    return new ApiRes(await this.paymentsService.recordPayment(id, dto, currentUser), 'Ghi nhan thanh toan thanh cong');
  }

  @Post(':id/refunds')
  @RequirePermissions(PermissionCode.OrdersRecordPayment)
  @ApiOperation({ summary: 'Record rental order refund' })
  @ApiOkResponse({ type: RentalOrderResponseDto })
  async recordRefund(@Param('id', IdValidatePipe) id: string, @Body() dto: RefundRentalOrderPaymentDto, @CurrentUser() currentUser: AuthUser) {
    return new ApiRes(await this.paymentsService.recordRefund(id, dto, currentUser), 'Ghi nhan hoan tien thanh cong');
  }
}
