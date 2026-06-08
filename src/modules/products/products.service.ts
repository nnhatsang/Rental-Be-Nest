import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { GetAllProductsInDto } from './dto/get-all-products.dto';
import { ProductOutDto } from './dto/product-out.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductRentalPriceTierInDto } from './dto/product-rental-price-tier.dto';
import { buildProductSearchText, normalizeSearchText } from '@/libs/utils/search-text.util';
import {
  PRODUCT_BRAND_NOT_FOUND,
  PRODUCT_CATEGORY_NOT_FOUND,
  PRODUCT_NOT_FOUND,
  PRODUCT_RENTAL_PRICE_TIER_INVALID,
  PRODUCT_SKU_EXISTED,
} from '@/libs/constants/error.constants';

type ProductWithRelations = Awaited<ReturnType<ProductsService['findProductById']>>;
type ExistingProductWithRelations = NonNullable<ProductWithRelations>;
type ProductRelation = { id: string; name: string } | null;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllProducts(query: GetAllProductsInDto) {
    const { search, categoryId, brandId, isActive, page, perPage } = query;
    const skip = (page - 1) * perPage;
    const searchText = normalizeSearchText(search);

    const where = {
      deletedAt: null,
      ...(categoryId && { categoryId }),
      ...(brandId && { brandId }),
      ...(isActive !== undefined && { isActive }),
      ...(searchText && {
        searchText: {
          contains: searchText,
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take: perPage,
        orderBy: {
          createdAt: 'desc',
        },
        include: this.productInclude(),
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((product) => this.toProductOut(product)),
      total,
      page,
      perPage,
    };
  }

  async getProductById(id: string): Promise<ProductOutDto> {
    const product = await this.findExistingProductById(id);
    return this.toProductOut(product);
  }

  async createProduct(dto: CreateProductDto): Promise<ProductOutDto> {
    const {
      name,
      sku,
      description,
      includedAccessories,
      usageGuide,
      categoryId,
      brandId,
      dailyPrice,
      halfDayPrice,
      hourlyOveragePrice,
      rentalPriceTiers,
      depositAmount,
      replacementValue,
      isActive,
    } = dto;

    await this.ensureSkuAvailable(sku);
    this.validateRentalPriceTiers(rentalPriceTiers);
    const [category, brand] = await Promise.all([this.findCategoryOrThrow(categoryId), this.findBrandOrThrow(brandId)]);

    const product = await this.prisma.product.create({
      data: {
        name,
        sku,
        description,
        includedAccessories,
        usageGuide,
        categoryId,
        brandId,
        dailyPrice,
        halfDayPrice,
        hourlyOveragePrice,
        rentalPriceTiers: rentalPriceTiers?.length
          ? {
              create: rentalPriceTiers.map((tier) => ({
                minDays: tier.minDays,
                maxDays: tier.maxDays,
                dailyPrice: tier.dailyPrice,
                name: tier.name,
                sortOrder: tier.sortOrder ?? 0,
              })),
            }
          : undefined,
        depositAmount,
        replacementValue,
        isActive: isActive ?? true,
        searchText: buildProductSearchText({
          name,
          sku,
          description,
          categoryName: category?.name,
          brandName: brand?.name,
        }),
      },
      include: this.productInclude(),
    });

    return this.toProductOut(product);
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<ProductOutDto> {
    const existingProduct = await this.findExistingProductById(id);

    if (dto.sku) {
      await this.ensureSkuAvailable(dto.sku, id);
    }
    this.validateRentalPriceTiers(dto.rentalPriceTiers);

    const [category, brand] = await Promise.all([
      dto.categoryId ? this.findCategoryOrThrow(dto.categoryId) : existingProduct.category,
      dto.brandId ? this.findBrandOrThrow(dto.brandId) : existingProduct.brand,
    ]);

    const nextProduct = {
      name: dto.name ?? existingProduct.name,
      sku: dto.sku ?? existingProduct.sku,
      description: dto.description ?? existingProduct.description,
      categoryName: category?.name,
      brandName: brand?.name,
    };

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        sku: dto.sku,
        description: dto.description,
        includedAccessories: dto.includedAccessories,
        usageGuide: dto.usageGuide,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        dailyPrice: dto.dailyPrice,
        halfDayPrice: dto.halfDayPrice,
        hourlyOveragePrice: dto.hourlyOveragePrice,
        rentalPriceTiers: dto.rentalPriceTiers
          ? {
              updateMany: {
                where: {
                  deletedAt: null,
                },
                data: {
                  deletedAt: new Date(),
                },
              },
              create: dto.rentalPriceTiers.map((tier) => ({
                minDays: tier.minDays,
                maxDays: tier.maxDays,
                dailyPrice: tier.dailyPrice,
                name: tier.name,
                sortOrder: tier.sortOrder ?? 0,
              })),
            }
          : undefined,
        depositAmount: dto.depositAmount,
        replacementValue: dto.replacementValue,
        isActive: dto.isActive,
        searchText: buildProductSearchText(nextProduct),
      },
      include: this.productInclude(),
    });

    return this.toProductOut(product);
  }

  async updateProductStatus(id: string, dto: UpdateProductStatusDto): Promise<ProductOutDto> {
    await this.findExistingProductById(id);

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        isActive: dto.isActive,
      },
      include: this.productInclude(),
    });

    return this.toProductOut(product);
  }

  async deleteProduct(id: string): Promise<{ success: true }> {
    await this.findExistingProductById(id);

    await this.prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return { success: true };
  }

  async getActiveProductsForRental(productIds: string[]) {
    const uniqueProductIds = [...new Set(productIds)];

    if (uniqueProductIds.length === 0) {
      return [];
    }

    return this.prisma.product.findMany({
      where: {
        id: {
          in: uniqueProductIds,
        },
        isActive: true,
        deletedAt: null,
      },
      include: {
        rentalPriceTiers: {
          where: {
            deletedAt: null,
          },
          orderBy: [{ sortOrder: 'asc' }, { minDays: 'asc' }],
        },
      },
    });
  }

  private async findExistingProductById(id: string): Promise<ExistingProductWithRelations> {
    const product = await this.findProductById(id);

    if (!product) {
      throw new NotFoundException(PRODUCT_NOT_FOUND);
    }

    return product;
  }

  private async findProductById(id: string) {
    return this.prisma.product.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: this.productInclude(),
    });
  }

  private async ensureSkuAvailable(sku: string, excludedProductId?: string): Promise<void> {
    const existingProduct = await this.prisma.product.findUnique({
      where: { sku },
      select: { id: true },
    });

    if (existingProduct && existingProduct.id !== excludedProductId) {
      throw new BadRequestException(PRODUCT_SKU_EXISTED);
    }
  }

  private async findCategoryOrThrow(categoryId?: string): Promise<ProductRelation> {
    if (!categoryId) {
      return null;
    }

    const category = await this.prisma.productCategory.findFirst({
      where: {
        id: categoryId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!category) {
      throw new BadRequestException(PRODUCT_CATEGORY_NOT_FOUND);
    }

    return category;
  }

  private async findBrandOrThrow(brandId?: string): Promise<ProductRelation> {
    if (!brandId) {
      return null;
    }

    const brand = await this.prisma.brand.findFirst({
      where: {
        id: brandId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!brand) {
      throw new BadRequestException(PRODUCT_BRAND_NOT_FOUND);
    }

    return brand;
  }

  private productInclude(): Prisma.ProductInclude {
    return {
      category: true,
      brand: true,
      rentalPriceTiers: {
        where: {
          deletedAt: null,
        },
        orderBy: [{ sortOrder: 'asc' }, { minDays: 'asc' }],
      },
    };
  }

  private validateRentalPriceTiers(rentalPriceTiers?: ProductRentalPriceTierInDto[]): void {
    if (!rentalPriceTiers?.length) {
      return;
    }

    const sortedTiers = [...rentalPriceTiers].sort((a, b) => a.minDays - b.minDays);

    for (let index = 0; index < sortedTiers.length; index++) {
      const tier = sortedTiers[index];

      if (tier.maxDays !== undefined && tier.maxDays < tier.minDays) {
        throw new BadRequestException(PRODUCT_RENTAL_PRICE_TIER_INVALID);
      }

      const nextTier = sortedTiers[index + 1];
      if (!nextTier) {
        continue;
      }

      const currentMaxDays = tier.maxDays ?? Number.POSITIVE_INFINITY;
      if (currentMaxDays >= nextTier.minDays) {
        throw new BadRequestException(PRODUCT_RENTAL_PRICE_TIER_INVALID);
      }
    }
  }

  private toProductOut(product: ExistingProductWithRelations): ProductOutDto {
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      description: product.description,
      includedAccessories: product.includedAccessories,
      usageGuide: product.usageGuide,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
          }
        : null,
      brand: product.brand
        ? {
            id: product.brand.id,
            name: product.brand.name,
          }
        : null,
      dailyPrice: product.dailyPrice.toString(),
      halfDayPrice: product.halfDayPrice?.toString() ?? null,
      hourlyOveragePrice: product.hourlyOveragePrice?.toString() ?? null,
      rentalPriceTiers: product.rentalPriceTiers.map((tier) => ({
        id: tier.id,
        minDays: tier.minDays,
        maxDays: tier.maxDays,
        dailyPrice: tier.dailyPrice.toString(),
        name: tier.name,
        sortOrder: tier.sortOrder,
        createdAt: tier.createdAt,
        updatedAt: tier.updatedAt,
        deletedAt: tier.deletedAt,
      })),
      depositAmount: product.depositAmount.toString(),
      replacementValue: product.replacementValue?.toString() ?? null,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      deletedAt: product.deletedAt,
    };
  }
}
