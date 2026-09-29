import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { SUCCESS } from '@/libs/constants/response.constant';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateCategoryStatusDto } from './dto/update-category-status.dto';
import { GetAllCategoriesDto } from './dto/get-all-categories.dto';
import { DeleteCategoriesDto } from './dto/delete-categories.dto';
import { CategoriesPaginatedResponseDto, CategoryResponseDto, DeleteCategoriesResponseDto } from './dto/categories-response.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequirePermissions(PermissionCode.CategoriesRead)
  @ApiOperation({ summary: 'Lấy danh sách danh mục sản phẩm' })
  @ApiOkResponse({ type: CategoriesPaginatedResponseDto })
  async getAll(@Query() query: GetAllCategoriesDto) {
    return new ApiPaginatedResponseDto(await this.categoriesService.getAll(query), SUCCESS);
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.CategoriesRead)
  @ApiOperation({ summary: 'Lấy chi tiết danh mục sản phẩm' })
  @ApiOkResponse({ type: CategoryResponseDto })
  async getById(@Param('id', IdValidatePipe) id: string) {
    return new ApiRes(await this.categoriesService.getById(id), SUCCESS);
  }

  @Post()
  @RequirePermissions(PermissionCode.CategoriesCreate)
  @ApiOperation({ summary: 'Tạo danh mục sản phẩm' })
  @ApiOkResponse({ type: CategoryResponseDto })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return new ApiRes(await this.categoriesService.create(dto, user.id), SUCCESS);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.CategoriesUpdate)
  @ApiOperation({ summary: 'Cập nhật danh mục sản phẩm' })
  @ApiOkResponse({ type: CategoryResponseDto })
  async update(@CurrentUser() user: AuthUser, @Param('id', IdValidatePipe) id: string, @Body() dto: UpdateCategoryDto) {
    return new ApiRes(await this.categoriesService.update(id, dto, user.id), SUCCESS);
  }

  @Patch(':id/status')
  @RequirePermissions(PermissionCode.CategoriesUpdate)
  @ApiOperation({ summary: 'Bật hoặc tắt danh mục sản phẩm' })
  @ApiOkResponse({ type: CategoryResponseDto })
  async updateStatus(@CurrentUser() user: AuthUser, @Param('id', IdValidatePipe) id: string, @Body() dto: UpdateCategoryStatusDto) {
    return new ApiRes(await this.categoriesService.updateStatus(id, dto, user.id), SUCCESS);
  }

  @Delete()
  @RequirePermissions(PermissionCode.CategoriesDelete)
  @ApiOperation({ summary: 'Xóa mềm nhiều danh mục sản phẩm' })
  @ApiOkResponse({ type: DeleteCategoriesResponseDto })
  async remove(@CurrentUser() user: AuthUser, @Body() dto: DeleteCategoriesDto) {
    return new ApiRes(await this.categoriesService.remove(dto, user.id), SUCCESS);
  }
}
