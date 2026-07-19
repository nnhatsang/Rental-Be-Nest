import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetCondition, AssetStatus } from '@generated/prisma/enums';
import { PrismaService } from '../database/prisma.service';
import { CreateAssetUnitDto } from './dto/create-asset-unit.dto';
import { UpdateAssetUnitDto } from './dto/update-asset-unit.dto';
import { GetAllAssetUnitsInDto } from './dto/get-all-asset-unit.dto';
import { UpdateAssetUnitStatusDto } from './dto/update-asset-unit-status.dto';
import { AssetUnitOutDto } from './dto/asset-unit-out.dto';
import { ASSET_UNIT_NOT_FOUND, ASSET_UNIT_SERIAL_NUMBER_EXISTED, PRODUCT_NOT_FOUND } from '@/libs/constants/error.constants';
import { buildAssetUnitSearchText, normalizeSearchText } from '@/libs/utils/search-text.util';
import { DeleteAssetUnitsDto } from './dto/delete-asset-unit.dto';

type AssetUnitWithRelations = Awaited<ReturnType<AssetUnitsService['findAssetUnitById']>>;
type ExistingAssetUnitWithRelations = NonNullable<AssetUnitWithRelations>;
type AssetUnitProduct = { id: string; name: string; sku: string };

@Injectable()
export class AssetUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllAssetUnits(query: GetAllAssetUnitsInDto) {
    const { page, perPage, condition, isActive, productId, search, status, sort, sortBy } = query;
    const skip = (page - 1) * perPage;
    const searchText = normalizeSearchText(search);

    const where = {
      deletedAt: null,
      ...(productId && { productId }),
      ...(status && { status }),
      ...(condition && { condition }),
      ...(isActive !== undefined && { isActive }),
      ...(searchText && {
        searchText: {
          contains: searchText,
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.assetUnit.findMany({
        where,
        skip,
        take: perPage,
        orderBy: [{ [sortBy]: sort }, { id: 'asc' }],
        include: this.assetUnitInclude(),
      }),
      this.prisma.assetUnit.count({ where }),
    ]);

    return {
      items: items.map((assetUnit) => this.toAssetUnitOut(assetUnit)),
      total,
      page,
      perPage,
    };
  }

  async getAssetUnitById(id: string): Promise<AssetUnitOutDto> {
    const assetUnit = await this.findExistingAssetUnitById(id);

    return this.toAssetUnitOut(assetUnit);
  }

  async createAssetUnit(dto: CreateAssetUnitDto, userId: string): Promise<AssetUnitOutDto> {
    const { productId, serialNumber, status, condition, note, isActive } = dto;

    await this.ensureSerialNumberAvailable(serialNumber);
    const product = await this.findActiveProductOrThrow(productId);

    const assetUnit = await this.prisma.assetUnit.create({
      data: {
        productId,
        serialNumber,
        status,
        condition,
        note,
        isActive: isActive ?? true,
        searchText: buildAssetUnitSearchText({
          serialNumber,
          note,
          status,
          condition,
          productName: product.name,
          productSku: product.sku,
        }),
        createdBy: userId,
      },
      include: this.assetUnitInclude(),
    });

    return this.toAssetUnitOut(assetUnit);
  }

  async updateAssetUnit(id: string, dto: UpdateAssetUnitDto, userId: string): Promise<AssetUnitOutDto> {
    const existingAssetUnit = await this.findExistingAssetUnitById(id);

    await this.ensureSerialNumberAvailable(dto.serialNumber, id);
    const product = dto.productId ? await this.findActiveProductOrThrow(dto.productId) : existingAssetUnit.product;

    const nextAssetUnit = {
      serialNumber: dto.serialNumber ?? existingAssetUnit.serialNumber,
      note: dto.note ?? existingAssetUnit.note,
      status: dto.status ?? existingAssetUnit.status,
      condition: dto.condition ?? existingAssetUnit.condition,
      productName: product.name,
      productSku: product.sku,
    };

    const assetUnit = await this.prisma.assetUnit.update({
      where: { id },
      data: {
        productId: dto.productId,
        serialNumber: dto.serialNumber,
        status: dto.status,
        condition: dto.condition,
        note: dto.note,
        isActive: dto.isActive,
        searchText: buildAssetUnitSearchText(nextAssetUnit),
        updatedBy: userId,
        updatedAt: new Date(),
      },
      include: this.assetUnitInclude(),
    });

    return this.toAssetUnitOut(assetUnit);
  }

  async updateAssetUnitStatus(id: string, dto: UpdateAssetUnitStatusDto, userId: string): Promise<AssetUnitOutDto> {
    const existingAssetUnit = await this.findExistingAssetUnitById(id);

    const assetUnit = await this.prisma.assetUnit.update({
      where: { id },
      data: {
        status: dto.status,
        condition: dto.condition,
        isActive: dto.isActive,
        searchText: buildAssetUnitSearchText({
          serialNumber: existingAssetUnit.serialNumber,
          note: existingAssetUnit.note,
          status: dto.status,
          condition: dto.condition,
          productName: existingAssetUnit.product.name,
          productSku: existingAssetUnit.product.sku,
        }),
        updatedBy: userId,
        updatedAt: new Date(),
      },
      include: this.assetUnitInclude(),
    });

    return this.toAssetUnitOut(assetUnit);
  }

  async deleteAssetUnit(dto: DeleteAssetUnitsDto, userId: string): Promise<{ success: true }> {
    const uniquedIds = [...new Set(dto.assetUnitIds)];
    await this.prisma.assetUnit.updateMany({
      where: { id: { in: uniquedIds } },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    return { success: true };
  }

  async getAssignableAssetUnits(assetUnitIds: string[]) {
    const uniqueAssetUnitIds = [...new Set(assetUnitIds)];

    if (uniqueAssetUnitIds.length === 0) {
      return [];
    }

    return this.prisma.assetUnit.findMany({
      where: {
        id: {
          in: uniqueAssetUnitIds,
        },
        isActive: true,
        deletedAt: null,
        status: {
          notIn: [AssetStatus.MAINTENANCE, AssetStatus.RETIRED, AssetStatus.LOST],
        },
        condition: {
          not: AssetCondition.LOST,
        },
      },
      select: {
        id: true,
        productId: true,
        serialNumber: true,
        status: true,
        condition: true,
      },
    });
  }

  async countAssignableAssetUnitsByProduct(productIds: string[]): Promise<Map<string, number>> {
    const uniqueProductIds = [...new Set(productIds)];

    if (uniqueProductIds.length === 0) {
      return new Map();
    }

    const groupedAssetUnits = await this.prisma.assetUnit.groupBy({
      by: ['productId'],
      where: {
        productId: {
          in: uniqueProductIds,
        },
        isActive: true,
        deletedAt: null,
        status: {
          notIn: [AssetStatus.MAINTENANCE, AssetStatus.RETIRED, AssetStatus.LOST],
        },
        condition: {
          not: AssetCondition.LOST,
        },
      },
      _count: {
        _all: true,
      },
    });

    return new Map(groupedAssetUnits.map((item) => [item.productId, item._count._all]));
  }

  private async findExistingAssetUnitById(id: string): Promise<ExistingAssetUnitWithRelations> {
    const assetUnit = await this.findAssetUnitById(id);

    if (!assetUnit) {
      throw new NotFoundException(ASSET_UNIT_NOT_FOUND);
    }

    return assetUnit;
  }

  private async findAssetUnitById(id: string) {
    return this.prisma.assetUnit.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: this.assetUnitInclude(),
    });
  }

  private async ensureSerialNumberAvailable(serialNumber?: string | null, excludedAssetUnitId?: string): Promise<void> {
    if (!serialNumber) {
      return;
    }

    const existingAssetUnit = await this.prisma.assetUnit.findUnique({
      where: { serialNumber },
      select: { id: true },
    });

    if (existingAssetUnit && existingAssetUnit.id !== excludedAssetUnitId) {
      throw new BadRequestException(ASSET_UNIT_SERIAL_NUMBER_EXISTED);
    }
  }

  private async findActiveProductOrThrow(productId: string): Promise<AssetUnitProduct> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        sku: true,
      },
    });

    if (!product) {
      throw new BadRequestException(PRODUCT_NOT_FOUND);
    }

    return product;
  }

  private assetUnitInclude() {
    return {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
    } as const;
  }

  private toAssetUnitOut(assetUnit: ExistingAssetUnitWithRelations): AssetUnitOutDto {
    return {
      id: assetUnit.id,
      product: {
        id: assetUnit.product.id,
        name: assetUnit.product.name,
        sku: assetUnit.product.sku,
      },
      serialNumber: assetUnit.serialNumber,
      status: assetUnit.status,
      condition: assetUnit.condition,
      note: assetUnit.note,
      isActive: assetUnit.isActive,
      createdAt: assetUnit.createdAt,
      updatedAt: assetUnit.updatedAt,
      deletedAt: assetUnit.deletedAt,
      createdBy: assetUnit.createdBy,
      updatedBy: assetUnit.updatedBy,
    };
  }
}
