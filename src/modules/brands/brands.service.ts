import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Brand } from '@generated/prisma/browser';
import { PrismaService } from '../database/prisma.service';
import { normalizeSearchText } from '@/libs/utils/search-text.util';
import { BRAND_NOT_FOUND, BRAND_SLUG_EXISTED } from '@/libs/constants/error.constants';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { UpdateBrandStatusDto } from './dto/update-brand-status.dto';
import { GetAllBrandsDto } from './dto/get-all-brands.dto';
import { DeleteBrandsDto } from './dto/delete-brands.dto';
import { BrandOutDto } from './dto/brand-out.dto';

type BrandWithCount = Brand & { _count: { products: number } };

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(query: GetAllBrandsDto) {
    const { search, page, perPage, sort, sortBy, isActive } = query;
    const searchText = normalizeSearchText(search);
    const where = {
      deletedAt: null,
      ...(isActive === undefined ? {} : { isActive }),
      ...(searchText ? { searchText: { contains: searchText } } : {}),
    };
    const skip = (page - 1) * perPage;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.brand.findMany({
        where,
        skip,
        take: perPage,
        orderBy: [{ [sortBy]: sort }, { id: 'asc' }],
        include: this.brandInclude(),
      }),
      this.prisma.brand.count({ where }),
    ]);
    return { items: items.map((item) => this.toOut(item)), total, page, perPage };
  }

  async getById(id: string): Promise<BrandOutDto> {
    return this.toOut(await this.findExisting(id));
  }

  async create(dto: CreateBrandDto, userId: string): Promise<BrandOutDto> {
    const name = dto.name.trim();
    const slug = this.normalizeSlug(dto.slug);
    await this.ensureSlugAvailable(slug);
    const brand = await this.prisma.brand.create({
      data: {
        name,
        slug,
        isActive: dto.isActive ?? true,
        createdBy: userId,
        searchText: normalizeSearchText([name, slug].filter(Boolean).join(' ')),
      },
      include: this.brandInclude(),
    });
    return this.toOut(brand);
  }

  async update(id: string, dto: UpdateBrandDto, userId: string): Promise<BrandOutDto> {
    await this.findExisting(id);
    const slug = dto.slug === undefined ? undefined : this.normalizeSlug(dto.slug);
    if (slug !== undefined) await this.ensureSlugAvailable(slug, id);
    const current = await this.prisma.brand.findUniqueOrThrow({ where: { id }, select: { name: true, slug: true } });
    const nextName = dto.name?.trim() ?? current.name;
    const nextSlug = slug === undefined ? current.slug : slug;
    const brand = await this.prisma.brand.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        slug,
        isActive: dto.isActive,
        updatedBy: userId,
        searchText: normalizeSearchText([nextName, nextSlug].filter(Boolean).join(' ')),
      },
      include: this.brandInclude(),
    });
    return this.toOut(brand);
  }

  async updateStatus(id: string, dto: UpdateBrandStatusDto, userId: string): Promise<BrandOutDto> {
    await this.findExisting(id);
    return this.toOut(
      await this.prisma.brand.update({
        where: { id },
        data: { isActive: dto.isActive, updatedBy: userId },
        include: this.brandInclude(),
      }),
    );
  }

  async remove(dto: DeleteBrandsDto, userId: string): Promise<{ success: true }> {
    const ids = [...new Set(dto.brandIds)];
    await this.prisma.brand.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy: userId, isActive: false },
    });
    return { success: true };
  }

  private async findExisting(id: string): Promise<BrandWithCount> {
    const brand = await this.prisma.brand.findFirst({
      where: { id, deletedAt: null },
      include: this.brandInclude(),
    });
    if (!brand) throw new NotFoundException(BRAND_NOT_FOUND);
    return brand;
  }

  private brandInclude() {
    return {
      _count: {
        select: {
          products: { where: { deletedAt: null } },
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
    const existing = await this.prisma.brand.findFirst({
      where: { slug, ...(excludedId ? { id: { not: excludedId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new BadRequestException(BRAND_SLUG_EXISTED);
  }

  private toOut(brand: BrandWithCount): BrandOutDto {
    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      isActive: brand.isActive,
      productCount: brand._count.products,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
      deletedAt: brand.deletedAt,
    };
  }
}
