import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { GetAllProductsInDto } from './dto/get-all-products.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { DeleteProductResponseDto, ProductResponseDto, ProductsPaginatedResponseDto } from './dto/products-response.dto';
import { ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { SUCCESS } from '@/libs/constants/response.constant';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { DeleteProductsDto } from './dto/delete-products.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions(PermissionCode.ProductsRead)
  @ApiOperation({
    summary: 'Lấy danh sách sản phẩm',
    description: 'Trả về danh sách sản phẩm với phân trang, tìm kiếm và bộ lọc.',
  })
  @ApiOkResponse({ type: ProductsPaginatedResponseDto })
  async getAllProducts(@Query() query: GetAllProductsInDto) {
    const result = await this.productsService.getAllProducts(query);

    return new ApiPaginatedResponseDto(result, SUCCESS);
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.ProductsRead)
  @ApiOperation({
    summary: 'Lấy chi tiết sản phẩm',
    description: 'Trả về thông tin sản phẩm kèm theo category và brand.',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  async getProductById(@Param('id', IdValidatePipe) id: string) {
    return new ApiRes(await this.productsService.getProductById(id), 'Lay thong tin san pham thanh cong');
  }

  @Post()
  @RequirePermissions(PermissionCode.ProductsCreate)
  @ApiOperation({
    summary: 'Tạo sản phẩm',
    description: 'Tạo product model/type cho thuê.',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  async createProduct(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return new ApiRes(await this.productsService.createProduct(dto, user.id), 'Tạo sản phẩm thành công');
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.ProductsUpdate)
  @ApiOperation({
    summary: 'Cập nhật sản phẩm',
    description: 'Cập nhật thông tin cơ bản, giá thuê, category và brand của sản phẩm.',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  async updateProduct(@CurrentUser() user: AuthUser, @Param('id', IdValidatePipe) id: string, @Body() dto: UpdateProductDto) {
    return new ApiRes(await this.productsService.updateProduct(id, dto, user.id), 'Cập nhật sản phẩm thành công');
  }

  @Patch(':id/status')
  @RequirePermissions(PermissionCode.ProductsUpdate)
  @ApiOperation({
    summary: 'Cập nhật trạng thái sản phẩm',
    description: 'Bật/tắt sản phẩm cho việc tạo đơn mới.',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  async updateProductStatus(@CurrentUser() user: AuthUser, @Param('id', IdValidatePipe) id: string, @Body() dto: UpdateProductStatusDto) {
    return new ApiRes(await this.productsService.updateProductStatus(id, dto, user.id), 'Cập nhật trạng thái sản phẩm thành công');
  }

  @Delete()
  @RequirePermissions(PermissionCode.ProductsDelete)
  @ApiOperation({
    summary: 'Xóa mềm nhiều sản phẩm',
    description: 'Soft delete sản phẩm để giữ lịch sử đơn hàng.',
  })
  @ApiOkResponse({ type: DeleteProductResponseDto })
  async deleteProducts(@CurrentUser() user: AuthUser, @Body() dto: DeleteProductsDto) {
    return new ApiRes(await this.productsService.deleteProducts(dto, user.id), 'Xóa sản phẩm thành công');
  }
}
