import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { GetAllPermissionsDto } from './dto/get-all-permissions.dto';
import { PermissionsResponseDto } from './dto/permissions-response.dto';
import { ApiRes } from '@/libs/types/custom-response.type';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { PermissionCode } from '@/libs/constants/rbac.constant';

@ApiTags('permissions')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions(PermissionCode.RolesRead)
  @ApiOperation({ summary: 'Lay danh sach permission catalog' })
  @ApiOkResponse({ type: PermissionsResponseDto })
  async getAllPermissions(@Query() query: GetAllPermissionsDto) {
    return new ApiRes(await this.permissionsService.getAllPermissions(query), 'Lay danh sach quyen thanh cong');
  }
}
