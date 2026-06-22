import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StoreClosureService } from './store-closure.service';
import { CreateStoreClosureDto } from './dto/create-store-closure.dto';
import { UpdateStoreClosureDto } from './dto/update-store-closure.dto';
import { GetAllStoreClosuresDto } from './dto/get-all-store-closures.dto';
import { DeleteStoreClosureResponseDto, StoreClosureResponseDto, StoreClosuresPaginatedResponseDto } from './dto/store-closure-response.dto';
import { ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { SUCCESS } from '@/libs/constants/response.constant';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { DeleteStoreClosuresDto } from './dto/delete-store-closures.dto';

@ApiTags('store-closures')
@Controller('store-closures')
export class StoreClosureController {
  constructor(private readonly storeClosureService: StoreClosureService) {}

  @Get()
  @RequirePermissions(PermissionCode.SettingsRead)
  @ApiOperation({
    summary: 'Lây danh sách các lịch chặn của hàng',
    description: 'Trả về danh sách các lịch nghi/off/bao tri có phân trang và lọc theo type/khoảng thời gian.',
  })
  @ApiOkResponse({ type: StoreClosuresPaginatedResponseDto })
  async getAllStoreClosures(@Query() query: GetAllStoreClosuresDto) {
    const result = await this.storeClosureService.getAllStoreClosures(query);

    return new ApiPaginatedResponseDto(result, SUCCESS);
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.SettingsRead)
  @ApiOperation({
    summary: 'Lây chi tiết lịch chặn của hàng',
    description: 'Trả về chi tiết một khoảng thời gian shop nghi/off/bao tri.',
  })
  @ApiOkResponse({ type: StoreClosureResponseDto })
  async getStoreClosureById(@Param('id', IdValidatePipe) id: string) {
    return new ApiRes(await this.storeClosureService.getStoreClosureById(id), SUCCESS);
  }

  @Post()
  @RequirePermissions(PermissionCode.SettingsUpdate)
  @ApiOperation({
    summary: 'ạo lịch chặn của hàng',
    description: 'ạo khoảng thời gian shop nghi/off/bao tri để chặn đặt lịch mới.',
  })
  @ApiOkResponse({ type: StoreClosureResponseDto })
  async createStoreClosure(@CurrentUser() user: AuthUser, @Body() dto: CreateStoreClosureDto) {
    return new ApiRes(await this.storeClosureService.createStoreClosure(dto, user.id), SUCCESS);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.SettingsUpdate)
  @ApiOperation({
    summary: 'Cập nhật lịch chặn của hàng',
    description: 'Cập nhật thời gian, type hoặc lý do của lịch chặn.',
  })
  @ApiOkResponse({ type: StoreClosureResponseDto })
  async updateStoreClosure(@CurrentUser() user: AuthUser, @Param('id', IdValidatePipe) id: string, @Body() dto: UpdateStoreClosureDto) {
    return new ApiRes(await this.storeClosureService.updateStoreClosure(id, dto, user.id), SUCCESS);
  }

  @Delete()
  @RequirePermissions(PermissionCode.SettingsUpdate)
  @ApiOperation({
    summary: 'Xóa mềm nhiều lịch chặn của hàng',
    description: 'Soft delete nhieu lich nghi/off/bao tri',
  })
  @ApiOkResponse({ type: DeleteStoreClosureResponseDto })
  async deleteStoreClosures(@CurrentUser() user: AuthUser, @Body() dto: DeleteStoreClosuresDto) {
    return new ApiRes(await this.storeClosureService.deleteStoreClosures(dto, user.id), SUCCESS);
  }
}
