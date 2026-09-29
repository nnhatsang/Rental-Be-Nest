import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { SUCCESS } from '@/libs/constants/response.constant';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { UpdateBrandStatusDto } from './dto/update-brand-status.dto';
import { GetAllBrandsDto } from './dto/get-all-brands.dto';
import { DeleteBrandsDto } from './dto/delete-brands.dto';
import { BrandsPaginatedResponseDto, BrandResponseDto, DeleteBrandsResponseDto } from './dto/brands-response.dto';

@ApiTags('brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @RequirePermissions(PermissionCode.BrandsRead)
  @ApiOperation({ summary: 'Lấy danh sách thương hiệu sản phẩm' })
  @ApiOkResponse({ type: BrandsPaginatedResponseDto })
  async getAll(@Query() query: GetAllBrandsDto) {
    return new ApiPaginatedResponseDto(await this.brandsService.getAll(query), SUCCESS);
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.BrandsRead)
  @ApiOperation({ summary: 'Lấy chi tiết thương hiệu sản phẩm' })
  @ApiOkResponse({ type: BrandResponseDto })
  async getById(@Param('id', IdValidatePipe) id: string) {
    return new ApiRes(await this.brandsService.getById(id), SUCCESS);
  }

  @Post()
  @RequirePermissions(PermissionCode.BrandsCreate)
  @ApiOperation({ summary: 'Tạo thương hiệu sản phẩm' })
  @ApiOkResponse({ type: BrandResponseDto })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateBrandDto) {
    return new ApiRes(await this.brandsService.create(dto, user.id), SUCCESS);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.BrandsUpdate)
  @ApiOperation({ summary: 'Cập nhật thương hiệu sản phẩm' })
  @ApiOkResponse({ type: BrandResponseDto })
  async update(@CurrentUser() user: AuthUser, @Param('id', IdValidatePipe) id: string, @Body() dto: UpdateBrandDto) {
    return new ApiRes(await this.brandsService.update(id, dto, user.id), SUCCESS);
  }

  @Patch(':id/status')
  @RequirePermissions(PermissionCode.BrandsUpdate)
  @ApiOperation({ summary: 'Bật hoặc tắt thương hiệu sản phẩm' })
  @ApiOkResponse({ type: BrandResponseDto })
  async updateStatus(@CurrentUser() user: AuthUser, @Param('id', IdValidatePipe) id: string, @Body() dto: UpdateBrandStatusDto) {
    return new ApiRes(await this.brandsService.updateStatus(id, dto, user.id), SUCCESS);
  }

  @Delete()
  @RequirePermissions(PermissionCode.BrandsDelete)
  @ApiOperation({ summary: 'Xóa mềm nhiều thương hiệu sản phẩm' })
  @ApiOkResponse({ type: DeleteBrandsResponseDto })
  async remove(@CurrentUser() user: AuthUser, @Body() dto: DeleteBrandsDto) {
    return new ApiRes(await this.brandsService.remove(dto, user.id), SUCCESS);
  }
}
