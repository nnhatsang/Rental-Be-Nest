import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductCategory } from '@generated/prisma/browser';
import { PrismaService } from '../database/prisma.service';
import { normalizeSearchText } from '@/libs/utils/search-text.util';
import {
  CATEGORY_NOT_FOUND,
  CATEGORY_SLUG_EXISTED,
} from '@/libs/constants/error.constants';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateCategoryStatusDto } from './dto/update-category-status.dto';
import { GetAllCategoriesDto } from './dto/get-all-categories.dto';
import { DeleteCategoriesDto } from './dto/delete-categories.dto';
import { CategoryOutDto } from './dto/category-out.dto';

type CategoryWithCount = ProductCategory & { _count: { products: number } };

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(query: GetAllCategoriesDto) {
    const { search, page, perPage, sort, sortBy, isActive } = query;
    const searchText = normalizeSearchText(search);
    const where = {
      deletedAt: null,
      ...(isActive === undefined ? {} : { isActive }),
      ...(searchText ? { searchText: { contains: searchText } } : {}),
    };
    const skip = (page - 1) * perPage;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.productCategory.findMany({
        where,
        skip,
        take: perPage,
        orderBy: [{ [sortBy]: sort }, { id: 'asc' }],
        include: this.categoryInclude(),
      }),
      this.prisma.productCategory.count({ where }),
    ]);

    return { items: items.map((item) => this.toOut(item)), total, page, perPage };
  }

  async getById(id: string): Promise<CategoryOutDto> {
    return this.toOut(await this.findExisting(id));
  }

  async create(dto: CreateCategoryDto, userId: string): Promise<CategoryOutDto> {
    const name = dto.name.trim();
    const slug = this.normalizeSlug(dto.slug);
    await this.ensureSlugAvailable(slug);
    const category = await this.prisma.productCategory.create({
      data: {
        name,
        slug,
        isActive: dto.isActive ?? true,
        createdBy: userId,
        searchText: normalizeSearchText([name, slug].filter(Boolean).join(' ')),
      },
      include: this.categoryInclude(),
    });
    return this.toOut(category);
  }

  async update(id: string, dto: UpdateCategoryDto, userId: string): Promise<CategoryOutDto> {
    await this.findExisting(id);
    const slug = dto.slug === undefined ? undefined : this.normalizeSlug(dto.slug);
    if (slug !== undefined) await this.ensureSlugAvailable(slug, id);
    const name = dto.name?.trim();
    const current = await this.prisma.productCategory.findUniqueOrThrow({ where: { id }, select: { name: true, slug: true } });
    const nextName = name ?? current.name;
    const nextSlug = slug === undefined ? current.slug : slug;
    const category = await this.prisma.productCategory.update({
      where: { id },
      data: {
        name,
        slug,
        isActive: dto.isActive,
        updatedBy: userId,
        searchText: normalizeSearchText([nextName, nextSlug].filter(Boolean).join(' ')),
      },
      include: this.categoryInclude(),
    });
    return this.toOut(category);
  }

  async updateStatus(id: string, dto: UpdateCategoryStatusDto, userId: string): Promise<CategoryOutDto> {
    await this.findExisting(id);
    return this.toOut(
      await this.prisma.productCategory.update({
        where: { id },
        data: { isActive: dto.isActive, updatedBy: userId },
        include: this.categoryInclude(),
      }),
    );
  }

  async remove(dto: DeleteCategoriesDto, userId: string): Promise<{ success: true }> {
    const ids = [...new Set(dto.categoryIds)];
    await this.prisma.productCategory.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy: userId, isActive: false },
    });
    return { success: true };
  }

  private async findExisting(id: string): Promise<CategoryWithCount> {
    const category = await this.prisma.productCategory.findFirst({
      where: { id, deletedAt: null },
      include: this.categoryInclude(),
    });
    if (!category) throw new NotFoundException(CATEGORY_NOT_FOUND);
    return category;
  }

  private categoryInclude() {
    return {
      _count: {
        select: {
          products: {
            where: { product: { deletedAt: null } },
          },
        },
      },
    } as const;
  }

  private normalizeSlug(value?: string): string | null {
    const normalized = value?.trim().toLowerCase();
    return normalized || null;
  }

  private async ensureSlugAvailable(slug: string | null, excludedId?: string): Promise<void> {
    if (!slug) return;
    const existing = await this.prisma.productCategory.findFirst({
      where: { slug, ...(excludedId ? { id: { not: excludedId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new BadRequestException(CATEGORY_SLUG_EXISTED);
  }

  private toOut(category: CategoryWithCount): CategoryOutDto {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      isActive: category.isActive,
      productCount: category._count.products,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      deletedAt: category.deletedAt,
    };
  }
}
