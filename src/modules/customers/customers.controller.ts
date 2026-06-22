import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { GetAllCustomersInDto } from './dto/get-all-customers.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { CustomerResponseDto, CustomersPaginatedResponseDto, DeleteCustomerResponseDto } from './dto/customers-response.dto';
import { ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { SUCCESS } from '@/libs/constants/response.constant';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { DeleteCustomersDto } from './dto/delete-customers.dto';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions(PermissionCode.CustomersRead)
  @ApiOperation({
    summary: 'Lấy danh sách khách hàng',
    description: 'Trả về danh sách khách hàng với phân trang và bộ lọc tùy chọn.',
  })
  @ApiOkResponse({ type: CustomersPaginatedResponseDto })
  async getAllCustomers(@Query() query: GetAllCustomersInDto) {
    const result = await this.customersService.getAllCustomers(query);

    return new ApiPaginatedResponseDto(result, SUCCESS);
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.CustomersRead)
  @ApiOperation({
    summary: 'Lấy chi tiết khách hàng',
    description: 'Trả về thông tin khách hàng theo id.',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  async getCustomerById(@Param('id', IdValidatePipe) id: string) {
    return new ApiRes(await this.customersService.getCustomerById(id), SUCCESS);
  }

  @Post()
  @RequirePermissions(PermissionCode.CustomersCreate)
  @ApiOperation({
    summary: 'Tạo khách hàng',
    description: 'ạo hồ sơ khách thuê do admin/staff quản lý.',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  async createCustomer(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    return new ApiRes(await this.customersService.createCustomer(dto, user.id), SUCCESS);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.CustomersUpdate)
  @ApiOperation({
    summary: 'Cập nhật khách hàng',
    description: 'ập nhật thông tin cơ bản của khách hàng.',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  async updateCustomer(@CurrentUser() user: AuthUser, @Param('id', IdValidatePipe) id: string, @Body() dto: UpdateCustomerDto) {
    return new ApiRes(await this.customersService.updateCustomer(id, dto, user.id), SUCCESS);
  }

  @Patch(':id/status')
  @RequirePermissions(PermissionCode.CustomersUpdate)
  @ApiOperation({
    summary: 'Cập nhật trạng thái khách hàng',
    description: 'Đổi trạng thái khách hàng: ACTIVE, INACTIVE, BLOCKED.',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  async updateCustomerStatus(@CurrentUser() user: AuthUser, @Param('id', IdValidatePipe) id: string, @Body() dto: UpdateCustomerStatusDto) {
    return new ApiRes(await this.customersService.updateCustomerStatus(id, dto, user.id), 'Cập nhật trạng thái khách hàng thành công');
  }

  @Delete()
  @RequirePermissions(PermissionCode.CustomersDelete)
  @ApiOperation({
    summary: 'Xóa mềm nhiều khách hàng',
    description: 'Soft delete hồ sơ khách hàng.',
  })
  @ApiOkResponse({ type: DeleteCustomerResponseDto })
  async deleteCustomers(@CurrentUser() user: AuthUser, @Body() dto: DeleteCustomersDto) {
    return new ApiRes(await this.customersService.deleteCustomers(dto, user.id), 'Xoá thành công');
  }
}
