import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { GetAllUsersInDto } from './dto/get-all-users.in.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserActivityStatusDto } from './dto/update-user-activity-status.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { DeleteUserResponseDto, SuccessUserActionResponseDto, UserResponseDto, UsersPaginatedResponseDto } from './dto/users-response.dto';
import { ApiNullableRes, ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { PermissionCode } from '@/libs/constants/rbac.constant';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PermissionCode.UsersRead)
  @ApiOperation({
    summary: 'Lấy danh sách người dùng nội bộ',
    description: 'Trả về danh sách admin/staff có phân trang, tìm kiếm, lọc theo trạng thái và role.',
  })
  @ApiOkResponse({ type: UsersPaginatedResponseDto })
  async getAllUsers(@Query() query: GetAllUsersInDto) {
    const result = await this.usersService.getAllUsers(query);

    return new ApiPaginatedResponseDto(result, 'Lấy danh sách người dùng thành công');
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.UsersRead)
  @ApiOperation({
    summary: 'Lấy chi tiết người dùng nội bộ',
    description: 'Trả về thông tin tài khoản nội bộ theo id, không bao gồm passwordHash.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  async getUserById(@Param('id', IdValidatePipe) id: string) {
    return new ApiRes(await this.usersService.getUserById(id), 'Lấy thông tin người dùng thành công');
  }

  @Post()
  @RequirePermissions(PermissionCode.UsersCreate)
  @ApiOperation({
    summary: 'Tạo người dùng nội bộ',
    description: 'Tạo tài khoản admin/staff mới và gán role. Nếu không truyền roleCodes, mặc định gán STAFF.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  async createUser(@Body() dto: CreateUserDto) {
    return new ApiRes(await this.usersService.createUser(dto), 'Tạo người dùng thành công');
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.UsersUpdate)
  @ApiOperation({
    summary: 'Cập nhật thông tin người dùng nội bộ',
    description: 'Cập nhật thông tin cơ bản của tài khoản nội bộ.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  async updateUser(@Param('id', IdValidatePipe) id: string, @Body() dto: UpdateUserDto) {
    return new ApiRes(await this.usersService.updateUser(id, dto), 'Cập nhật người dùng thành công');
  }

  @Patch(':id/activity-status')
  @RequirePermissions(PermissionCode.UsersUpdate)
  @ApiOperation({
    summary: 'Cập nhật trạng thái hoạt động của người dùng',
    description: 'Đổi trạng thái đăng nhập của tài khoản: ACTIVE, BANNED, LOCKED hoặc INACTIVE.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  async updateUserActivityStatus(@Param('id', IdValidatePipe) id: string, @Body() dto: UpdateUserActivityStatusDto) {
    return new ApiRes(await this.usersService.updateUserActivityStatus(id, dto), 'Cập nhật trạng thái người dùng thành công');
  }

  @Patch(':id/roles')
  @RequirePermissions(PermissionCode.UsersUpdate)
  @ApiOperation({
    summary: 'Cập nhật vai trò của người dùng',
    description: 'Thay thế toàn bộ danh sách role hiện tại của user bằng danh sách roleCodes mới.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  async updateUserRoles(@Param('id', IdValidatePipe) id: string, @Body() dto: UpdateUserRolesDto) {
    return new ApiRes(await this.usersService.updateUserRoles(id, dto), 'Cập nhật vai trò người dùng thành công');
  }

  @Patch(':id/password')
  @RequirePermissions(PermissionCode.UsersUpdate)
  @ApiOperation({
    summary: 'Reset mat khau nguoi dung noi bo',
    description: 'Admin reset mat khau cho nhan vien khac, khong yeu cau mat khau cu va revoke toan bo phien dang nhap cua user do.',
  })
  @ApiOkResponse({ type: SuccessUserActionResponseDto })
  async resetUserPassword(
    @Param('id', IdValidatePipe) id: string,
    @CurrentUser() currentUser: AuthUser,
    @Body() dto: ResetUserPasswordDto,
  ) {
    return new ApiRes(await this.usersService.resetUserPassword(id, currentUser.id, dto), 'Reset mat khau nguoi dung thanh cong');
  }

  @Delete(':id')
  @RequirePermissions(PermissionCode.UsersDelete)
  @ApiOperation({
    summary: 'Xoá mềm người dùng nội bộ',
    description: 'Soft delete an internal account and revoke active auth sessions.',
  })
  @ApiOkResponse({ type: DeleteUserResponseDto })
  async deleteUser(@Param('id', IdValidatePipe) id: string, @CurrentUser() currentUser: AuthUser) {
    return new ApiNullableRes(await this.usersService.deleteUser(id, currentUser.id), 'Xóa người dùng thành công');
  }
}
