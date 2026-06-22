import { PermissionCode } from '@/libs/constants/rbac.constant';
import { SUCCESS } from '@/libs/constants/response.constant';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { ApiNullableRes, ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { AssetUnitsService } from './asset-units.service';
import { AssetUnitResponseDto, AssetUnitsPaginatedResponseDto, DeleteAssetUnitResponseDto } from './dto/asset-units-response.dto';
import { CreateAssetUnitDto } from './dto/create-asset-unit.dto';
import { DeleteAssetUnitsDto } from './dto/delete-asset-unit.dto';
import { GetAllAssetUnitsInDto } from './dto/get-all-asset-unit.dto';
import { UpdateAssetUnitStatusDto } from './dto/update-asset-unit-status.dto';
import { UpdateAssetUnitDto } from './dto/update-asset-unit.dto';

@ApiTags('asset-units')
@Controller('asset-units')
export class AssetUnitsController {
  constructor(private readonly assetUnitsService: AssetUnitsService) {}

  @Get()
  @RequirePermissions(PermissionCode.AssetsRead)
  @ApiOperation({
    summary: 'Lay danh sach thiet bi vat ly',
    description: 'Tra ve danh sach asset unit voi phan trang, tim kiem va bo loc theo product/status/condition.',
  })
  @ApiOkResponse({ type: AssetUnitsPaginatedResponseDto })
  async getAllAssetUnits(@Query() query: GetAllAssetUnitsInDto) {
    const result = await this.assetUnitsService.getAllAssetUnits(query);

    return new ApiPaginatedResponseDto(result, SUCCESS);
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.AssetsRead)
  @ApiOperation({
    summary: 'Lay chi tiet thiet bi vat ly',
    description: 'Tra ve thong tin asset unit kem product name va SKU.',
  })
  @ApiOkResponse({ type: AssetUnitResponseDto })
  async getAssetUnitById(@Param('id', IdValidatePipe) id: string) {
    return new ApiRes(await this.assetUnitsService.getAssetUnitById(id), SUCCESS);
  }

  @Post()
  @RequirePermissions(PermissionCode.AssetsCreate)
  @ApiOperation({
    summary: 'Tao thiet bi vat ly',
    description: 'Tao mot asset unit/serial thuoc mot product dang hoat dong.',
  })
  @ApiOkResponse({ type: AssetUnitResponseDto })
  async createAssetUnit(@CurrentUser() user: AuthUser, @Body() dto: CreateAssetUnitDto) {
    return new ApiRes(await this.assetUnitsService.createAssetUnit(dto, user.id), SUCCESS);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.AssetsUpdate)
  @ApiOperation({
    summary: 'Cap nhat thiet bi vat ly',
    description: 'Cap nhat product, serial number, status, condition, note hoac trang thai kich hoat cua asset unit.',
  })
  @ApiOkResponse({ type: AssetUnitResponseDto })
  async updateAssetUnit(@CurrentUser() user: AuthUser, @Param('id', IdValidatePipe) id: string, @Body() dto: UpdateAssetUnitDto) {
    return new ApiRes(await this.assetUnitsService.updateAssetUnit(id, dto, user.id), SUCCESS);
  }

  @Patch(':id/status')
  @RequirePermissions(PermissionCode.AssetsUpdate)
  @ApiOperation({
    summary: 'Cap nhat tinh trang thiet bi vat ly',
    description: 'Cap nhat status, condition va isActive cua asset unit.',
  })
  @ApiOkResponse({ type: AssetUnitResponseDto })
  async updateAssetUnitStatus(@CurrentUser() user: AuthUser, @Param('id', IdValidatePipe) id: string, @Body() dto: UpdateAssetUnitStatusDto) {
    return new ApiRes(await this.assetUnitsService.updateAssetUnitStatus(id, dto, user.id), SUCCESS);
  }

  @Delete()
  @RequirePermissions(PermissionCode.AssetsDelete)
  @ApiOperation({
    summary: 'Xoá mềm nhiều thiết bị',
    description: 'Xoá mềm de giu lich su don hang va bao cao hu hong.',
  })
  @ApiOkResponse({ type: DeleteAssetUnitResponseDto })
  async deleteAssetUnit(@CurrentUser() user: AuthUser, @Body() dto: DeleteAssetUnitsDto) {
    return new ApiNullableRes(await this.assetUnitsService.deleteAssetUnit(dto, user.id), SUCCESS);
  }
}
