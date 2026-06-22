import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { DeleteRolesDto } from './dto/delete-roles.dto';
import { GetAllRolesDto } from './dto/get-all-roles.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { AssignRoleUsersDto } from './dto/assign-role-users.dto';
import { RoleActionResponseDto, RoleResponseDto, RolesPaginatedResponseDto } from './dto/roles-response.dto';
import { ApiNullableRes, ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { PermissionCode } from '@/libs/constants/rbac.constant';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions(PermissionCode.RolesRead)
  @ApiOperation({ summary: 'Lấy quyền hành công' })
  @ApiOkResponse({ type: RolesPaginatedResponseDto })
  async getAllRoles(@Query() query: GetAllRolesDto) {
    return new ApiPaginatedResponseDto(await this.rolesService.getAllRoles(query), 'Lấy danh sách quyền thành công');
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.RolesRead)
  @ApiOperation({ summary: 'Lay chi tiet vai tro' })
  @ApiOkResponse({ type: RoleResponseDto })
  async getRoleById(@Param('id', IdValidatePipe) id: string) {
    return new ApiRes(await this.rolesService.getRoleById(id), 'Lay vai tro thanh cong');
  }

  @Post()
  @RequirePermissions(PermissionCode.RolesCreate)
  @ApiOperation({ summary: 'Tao vai tro custom' })
  @ApiOkResponse({ type: RoleResponseDto })
  async createRole(@CurrentUser() user: AuthUser, @Body() dto: CreateRoleDto) {
    return new ApiRes(await this.rolesService.createRole(dto, user.id), 'Tao vai tro thanh cong');
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.RolesUpdate)
  @ApiOperation({ summary: 'Cap nhat thong tin vai tro custom' })
  @ApiOkResponse({ type: RoleResponseDto })
  async updateRole(@CurrentUser() user: AuthUser, @Param('id', IdValidatePipe) id: string, @Body() dto: UpdateRoleDto) {
    return new ApiRes(await this.rolesService.updateRole(id, dto, user.id), 'Cap nhat vai tro thanh cong');
  }

  @Put(':id/permissions')
  @RequirePermissions(PermissionCode.RolesUpdate)
  @ApiOperation({ summary: 'Thay the danh sach quyen cua vai tro custom' })
  @ApiOkResponse({ type: RoleResponseDto })
  async updateRolePermissions(@CurrentUser() user: AuthUser, @Param('id', IdValidatePipe) id: string, @Body() dto: UpdateRolePermissionsDto) {
    return new ApiRes(await this.rolesService.updateRolePermissions(id, dto, user.id), 'Cap nhat quyen cua vai tro thanh cong');
  }

  @Put('assign')
  @RequirePermissions(PermissionCode.UsersUpdate)
  @ApiOperation({ summary: 'Gan vai tro cho danh sach userIds' })
  @ApiOkResponse({ type: RoleResponseDto })
  async assignRoleUsers(@CurrentUser() currentUser: AuthUser, @Body() dto: AssignRoleUsersDto) {
    return new ApiRes(await this.rolesService.assignRoleUsers(dto, currentUser.id), 'Gán vai trò cho users thành công');
  }

  @Delete()
  @RequirePermissions(PermissionCode.RolesDelete)
  @ApiOperation({ summary: 'Xoa nhieu vai tro custom' })
  // @ApiOkResponse({ type: RoleActionResponseDto })
  async deleteRoles(@CurrentUser() user: AuthUser, @Body() dto: DeleteRolesDto) {
    await this.rolesService.multiDelete(dto, user.id);
    return new ApiNullableRes(null, 'Xóa các vai trò thành công');
  }
}
