import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { AssetCondition, AssetStatus, OrderStatus } from '@generated/prisma/enums';
import { AssetUnitsService } from '../../asset-units/asset-units.service';
import { PrismaService } from '../../database/prisma.service';
import { ProductsService } from '../../products/products.service';
import { RentalPolicyService } from '../../rental-policy/rental-policy.service';
import { StoreBusinessHoursService } from '../../store-business-hours/store-business-hours.service';
import { StoreClosureService } from '../../store-closure/store-closure.service';
import {
  CheckRentalOrderAvailabilityItemDto,
  CheckRentalOrderAvailabilityDto,
  RentalOrderAvailabilityOutDto,
  RentalOrderUnavailableItemDto,
} from '../dto/check-rental-order-availability.dto';
import {
  AssetAvailabilityReason,
  AssetAvailabilityState,
  AvailabilityAssetsOutDto,
  AvailabilityFilter,
  AvailabilityProductsOutDto,
  AvailabilityTimelineOutDto,
  GetAvailabilityAssetsDto,
  GetAvailabilityTimelineDto,
  GetAvailabilityProductsDto,
  ProductAvailabilityState,
} from '../dto/get-rental-order-availability.dto';
import {
  RENTAL_ORDER_ASSET_UNIT_INVALID,
  RENTAL_ORDER_PRODUCT_INVALID,
  RENTAL_ORDER_TIME_INVALID,
} from '@/libs/constants/error.constants';
import { normalizeSearchText } from '@/libs/utils/search-text.util';

export const BLOCKING_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.DELIVERING,
  OrderStatus.RENTING,
  OrderStatus.OVERDUE,
];

export type RentalPolicy = Awaited<ReturnType<RentalPolicyService['getDefaultPolicyForOrder']>>;

export type NormalizedRentalOrderItem = {
  id?: string;
  productId: string;
  assetUnitId?: string | null;
  note?: string | null;
};

@Injectable()
export class RentalOrderAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly assetUnitsService: AssetUnitsService,
    private readonly rentalPolicyService: RentalPolicyService,
    private readonly storeBusinessHoursService: StoreBusinessHoursService,
    private readonly storeClosureService: StoreClosureService,
  ) {}

  async checkRentalOrderAvailability(dto: CheckRentalOrderAvailabilityDto): Promise<RentalOrderAvailabilityOutDto> {
    return this.evaluateAvailability({
      startDate: dto.startDate,
      endDate: dto.endDate,
      items: this.normalizeItems(dto.items),
    });
  }

  async getAvailabilityProducts(dto: GetAvailabilityProductsDto): Promise<AvailabilityProductsOutDto> {
    const { blockedEndDate, turnaroundMinutes } = await this.validateAvailabilityWindow(dto.startDate, dto.endDate);
    const searchText = normalizeSearchText(dto.search);
    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(searchText && { searchText: { contains: searchText } }),
      },
      select: {
        id: true,
        name: true,
        sku: true,
        dailyPrice: true,
        halfDayPrice: true,
        rentalPriceTiers: {
          select: {
            id: true,
            minDays: true,
            maxDays: true,
            dailyPrice: true,
            name: true,
            sortOrder: true,
          },
          where: {
            deletedAt: null,
          },
          orderBy: [{ minDays: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const productIds = products.map((product) => product.id);
    const counts = await this.getAvailabilityCounts(productIds, dto.startDate, blockedEndDate, dto.excludeOrderId);

    const filteredItems = products
      .map((product) => {
        const total = counts.assignable.get(product.id) ?? 0;
        const reserved = counts.booked.get(product.id) ?? 0;
        const available = Math.max(total - reserved, 0);
        const availabilityState =
          available === 0
            ? ProductAvailabilityState.UNAVAILABLE
            : available <= 2
              ? ProductAvailabilityState.LOW_STOCK
              : ProductAvailabilityState.AVAILABLE;

        return {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          dailyPrice: product.dailyPrice.toString(),
          halfDayPrice: product.halfDayPrice.toString(),
          rentalPriceTiers: product.rentalPriceTiers.map((tier) => ({
            id: tier.id,
            minDays: tier.minDays,
            maxDays: tier.maxDays,
            dailyPrice: tier.dailyPrice.toString(),
            name: tier.name,
            sortOrder: tier.sortOrder,
          })),
          inventory: {
            total,
            reserved,
            available,
          },
          availabilityState,
        };
      })
      .filter((item) => {
        if (dto.availability === AvailabilityFilter.AVAILABLE) return item.inventory.available > 0;
        if (dto.availability === AvailabilityFilter.UNAVAILABLE) return item.inventory.available === 0;
        return true;
      });

    const startIndex = (dto.page - 1) * dto.perPage;
    const items = filteredItems.slice(startIndex, startIndex + dto.perPage);

    return {
      items,
      pagination: this.buildPagination(dto.page, dto.perPage, filteredItems.length, items.length),
      startDate: dto.startDate,
      endDate: dto.endDate,
      blockedEndDate,
      turnaroundMinutes,
    };
  }

  async getAvailabilityAssets(dto: GetAvailabilityAssetsDto): Promise<AvailabilityAssetsOutDto> {
    const { blockedEndDate } = await this.validateAvailabilityWindow(dto.startDate, dto.endDate);
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!product) throw new BadRequestException(RENTAL_ORDER_PRODUCT_INVALID);

    const searchText = normalizeSearchText(dto.search);
    const [assetUnits, counts] = await Promise.all([
      this.prisma.assetUnit.findMany({
        where: {
          productId: dto.productId,
          deletedAt: null,
          isActive: true,
          ...(searchText && { searchText: { contains: searchText } }),
        },
        select: { id: true, serialNumber: true, status: true, condition: true, isActive: true },
        orderBy: [{ serialNumber: 'asc' }, { id: 'asc' }],
      }),
      this.getAvailabilityCounts([dto.productId], dto.startDate, blockedEndDate, dto.excludeOrderId),
    ]);

    const bookedRows = assetUnits.length
      ? await this.prisma.rentalOrderItem.findMany({
          where: {
            deletedAt: null,
            assetUnitId: { in: assetUnits.map((asset) => asset.id) },
            order: this.blockingOrderWhere(dto.startDate, blockedEndDate, dto.excludeOrderId),
          },
          select: { assetUnitId: true, order: { select: { blockedEndDate: true } } },
        })
      : [];
    const conflictEndByAsset = new Map<string, Date>();
    for (const row of bookedRows) {
      if (!row.assetUnitId) continue;
      const current = conflictEndByAsset.get(row.assetUnitId);
      if (!current || current < row.order.blockedEndDate) conflictEndByAsset.set(row.assetUnitId, row.order.blockedEndDate);
    }

    const classified = assetUnits
      .map((asset) => {
        let availability = AssetAvailabilityState.AVAILABLE;
        let reasonCode: AssetAvailabilityReason | null = null;
        if (!asset.isActive) {
          availability = AssetAvailabilityState.UNASSIGNABLE;
          reasonCode = AssetAvailabilityReason.INACTIVE;
        } else if (asset.status === AssetStatus.MAINTENANCE) {
          availability = AssetAvailabilityState.UNASSIGNABLE;
          reasonCode = AssetAvailabilityReason.MAINTENANCE;
        } else if (asset.status === AssetStatus.RETIRED) {
          availability = AssetAvailabilityState.UNASSIGNABLE;
          reasonCode = AssetAvailabilityReason.RETIRED;
        } else if (asset.status === AssetStatus.LOST || asset.condition === AssetCondition.LOST) {
          availability = AssetAvailabilityState.UNASSIGNABLE;
          reasonCode = AssetAvailabilityReason.LOST;
        } else if (conflictEndByAsset.has(asset.id)) {
          availability = AssetAvailabilityState.BOOKED;
          reasonCode = AssetAvailabilityReason.BOOKED;
        }

        return {
          assetUnitId: asset.id,
          serialNumber: asset.serialNumber,
          status: asset.status,
          condition: asset.condition,
          availability,
          reasonCode,
          conflictBlockedEndDate: conflictEndByAsset.get(asset.id) ?? null,
        };
      })
      .filter((asset) => {
        if (dto.availability === AvailabilityFilter.AVAILABLE) return asset.availability === AssetAvailabilityState.AVAILABLE;
        if (dto.availability === AvailabilityFilter.UNAVAILABLE) return asset.availability !== AssetAvailabilityState.AVAILABLE;
        return true;
      });
    const startIndex = (dto.page - 1) * dto.perPage;
    const items = classified.slice(startIndex, startIndex + dto.perPage);
    const availableQuantity = Math.max((counts.assignable.get(dto.productId) ?? 0) - (counts.booked.get(dto.productId) ?? 0), 0);

    return {
      items,
      pagination: this.buildPagination(dto.page, dto.perPage, classified.length, items.length),
      productId: dto.productId,
      availableQuantity,
      selectionLimit: availableQuantity,
      blockedEndDate,
    };
  }

  async getAvailabilityTimeline(dto: GetAvailabilityTimelineDto): Promise<AvailabilityTimelineOutDto> {
    this.validateRentalTime(dto.startDate, dto.endDate);
    const searchText = normalizeSearchText(dto.search);
    const where: Prisma.AssetUnitWhereInput = {
      deletedAt: null,
      ...(searchText && { searchText: { contains: searchText } }),
    };
    const skip = (dto.page - 1) * dto.perPage;
    const [assetUnits, total] = await Promise.all([
      this.prisma.assetUnit.findMany({
        where,
        skip,
        take: dto.perPage,
        select: {
          id: true,
          serialNumber: true,
          status: true,
          condition: true,
          product: { select: { name: true, sku: true } },
        },
        orderBy: [{ product: { name: 'asc' } }, { serialNumber: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.assetUnit.count({ where }),
    ]);
    const assetUnitIds = assetUnits.map((asset) => asset.id);
    const bookedRows = assetUnitIds.length
      ? await this.prisma.rentalOrderItem.findMany({
          where: {
            deletedAt: null,
            assetUnitId: { in: assetUnitIds },
            order: this.blockingOrderWhere(dto.startDate, dto.endDate, dto.excludeOrderId),
          },
          select: {
            assetUnitId: true,
            order: {
              select: {
                id: true,
                code: true,
                status: true,
                customerNameSnapshot: true,
                startDate: true,
                endDate: true,
                blockedEndDate: true,
              },
            },
          },
          orderBy: [{ order: { startDate: 'asc' } }, { order: { id: 'asc' } }],
        })
      : [];

    const blocksByAsset = new Map<string, typeof bookedRows>();
    for (const row of bookedRows) {
      if (!row.assetUnitId) continue;
      blocksByAsset.set(row.assetUnitId, [...(blocksByAsset.get(row.assetUnitId) ?? []), row]);
    }

    return {
      items: assetUnits.map((asset) => ({
        assetUnitId: asset.id,
        serialNumber: asset.serialNumber,
        productName: asset.product.name,
        sku: asset.product.sku,
        status: asset.status,
        condition: asset.condition,
        blocks: (blocksByAsset.get(asset.id) ?? []).map((row) => ({
          orderId: row.order.id,
          orderCode: row.order.code,
          status: row.order.status,
          customerName: row.order.customerNameSnapshot,
          startDate: row.order.startDate,
          endDate: row.order.endDate,
          blockedEndDate: row.order.blockedEndDate,
        })),
      })),
      pagination: this.buildPagination(dto.page, dto.perPage, total, assetUnits.length),
      startDate: dto.startDate,
      endDate: dto.endDate,
    };
  }

  async evaluateAvailability(params: {
    startDate: Date;
    endDate: Date;
    items: NormalizedRentalOrderItem[];
    excludeOrderId?: string;
    rentalPolicy?: RentalPolicy;
    turnaroundMinutes?: number;
  }): Promise<RentalOrderAvailabilityOutDto> {
    this.validateRentalTime(params.startDate, params.endDate);
    this.validateRequestedItems(params.items);

    const turnaroundMinutes = params.turnaroundMinutes ?? params.rentalPolicy?.turnaroundMinutes;
    const rentalPolicy = turnaroundMinutes === undefined ? await this.rentalPolicyService.getDefaultPolicyForOrder() : params.rentalPolicy;
    const effectiveTurnaroundMinutes = turnaroundMinutes ?? rentalPolicy?.turnaroundMinutes ?? 60;
    const blockedEndDate = this.addMinutes(params.endDate, effectiveTurnaroundMinutes);

    await this.storeBusinessHoursService.assertRentalTimeWithinBusinessHours(params.startDate, params.endDate);
    await this.storeClosureService.assertNoClosureOverlap(params.startDate, params.endDate);

    const productIds = [...new Set(params.items.map((item) => item.productId))];
    const assetUnitIds = params.items.flatMap((item) => (item.assetUnitId ? [item.assetUnitId] : []));
    const [products, assetUnits, assignableAssetCountByProduct, bookedAssetUnitIds, bookedQuantityByProduct] = await Promise.all([
      this.productsService.getActiveProductsForRental(productIds),
      this.assetUnitsService.getAssignableAssetUnits(assetUnitIds),
      this.assetUnitsService.countAssignableAssetUnitsByProduct(productIds),
      this.getBookedAssetUnitIds(assetUnitIds, params.startDate, blockedEndDate, params.excludeOrderId),
      this.getBookedQuantityByProduct(productIds, params.startDate, blockedEndDate, params.excludeOrderId),
    ]);

    const productsById = new Map(products.map((product) => [product.id, product]));
    const assetUnitsById = new Map(assetUnits.map((assetUnit) => [assetUnit.id, assetUnit]));

    if (products.length !== productIds.length) {
      throw new BadRequestException(RENTAL_ORDER_PRODUCT_INVALID);
    }

    if (assetUnits.length !== assetUnitIds.length) {
      throw new BadRequestException(RENTAL_ORDER_ASSET_UNIT_INVALID);
    }

    for (const item of params.items) {
      if (!item.assetUnitId) {
        continue;
      }

      const assetUnit = assetUnitsById.get(item.assetUnitId);
      if (!assetUnit || assetUnit.productId !== item.productId) {
        throw new BadRequestException(RENTAL_ORDER_ASSET_UNIT_INVALID);
      }
    }

    const unavailableItems: RentalOrderUnavailableItemDto[] = [];

    for (const item of params.items) {
      if (item.assetUnitId && bookedAssetUnitIds.has(item.assetUnitId)) {
        unavailableItems.push({
          productId: item.productId,
          assetUnitId: item.assetUnitId,
          reason: 'Asset unit is already booked in this time range',
        });
      }
    }

    const requestedQuantityByProduct = this.countRequestedItemsByProduct(params.items);
    for (const [productId, requestedQuantity] of requestedQuantityByProduct.entries()) {
      const product = productsById.get(productId);
      if (!product) {
        throw new BadRequestException(RENTAL_ORDER_PRODUCT_INVALID);
      }

      const assignableAssetCount = assignableAssetCountByProduct.get(productId) ?? 0;
      const bookedQuantity = bookedQuantityByProduct.get(productId) ?? 0;

      if (assignableAssetCount === 0) {
        unavailableItems.push({
          productId,
          assetUnitId: null,
          reason: 'Product has no assignable asset units',
        });
        continue;
      }

      if (bookedQuantity + requestedQuantity > assignableAssetCount) {
        unavailableItems.push({
          productId,
          assetUnitId: null,
          reason: 'Product does not have enough available asset units in this time range',
        });
      }
    }

    return {
      isAvailable: unavailableItems.length === 0,
      startDate: params.startDate,
      endDate: params.endDate,
      blockedEndDate,
      turnaroundMinutes: effectiveTurnaroundMinutes,
      unavailableItems,
    };
  }

  normalizeItems(items: CheckRentalOrderAvailabilityItemDto[]): NormalizedRentalOrderItem[] {
    return items.flatMap((item) => {
      const assetUnitIds = item.assetUnitIds ?? [];

      if (assetUnitIds.length > item.quantity) {
        throw new BadRequestException(RENTAL_ORDER_ASSET_UNIT_INVALID);
      }

      return [
        ...assetUnitIds.map((assetUnitId) => ({
          productId: item.productId,
          assetUnitId,
        })),
        ...Array.from({ length: item.quantity - assetUnitIds.length }, () => ({
          productId: item.productId,
        })),
      ];
    });
  }

  validateRentalTime(startDate: Date, endDate: Date): void {
    if (startDate >= endDate) {
      throw new BadRequestException(RENTAL_ORDER_TIME_INVALID);
    }
  }

  validateRequestedItems(items: NormalizedRentalOrderItem[]): void {
    const assetUnitIds = new Set<string>();

    for (const item of items) {
      if (!item.assetUnitId) {
        continue;
      }

      if (assetUnitIds.has(item.assetUnitId)) {
        throw new BadRequestException(RENTAL_ORDER_ASSET_UNIT_INVALID);
      }

      assetUnitIds.add(item.assetUnitId);
    }
  }

  async getBookedAssetUnitIds(assetUnitIds: string[], startDate: Date, blockedEndDate: Date, excludeOrderId?: string): Promise<Set<string>> {
    const uniqueAssetUnitIds = [...new Set(assetUnitIds)];

    if (uniqueAssetUnitIds.length === 0) {
      return new Set();
    }

    const bookedItems = await this.prisma.rentalOrderItem.findMany({
      where: {
        deletedAt: null,
        assetUnitId: {
          in: uniqueAssetUnitIds,
        },
        order: this.blockingOrderWhere(startDate, blockedEndDate, excludeOrderId),
      },
      select: {
        assetUnitId: true,
      },
    });

    return new Set(bookedItems.flatMap((item) => (item.assetUnitId ? [item.assetUnitId] : [])));
  }

  blockingOrderWhere(startDate: Date, blockedEndDate: Date, excludeOrderId?: string): Prisma.RentalOrderWhereInput {
    return {
      deletedAt: null,
      ...(excludeOrderId && {
        id: {
          not: excludeOrderId,
        },
      }),
      status: {
        in: BLOCKING_ORDER_STATUSES,
      },
      startDate: {
        lt: blockedEndDate,
      },
      blockedEndDate: {
        gt: startDate,
      },
    };
  }

  private async validateAvailabilityWindow(startDate: Date, endDate: Date) {
    this.validateRentalTime(startDate, endDate);
    const rentalPolicy = await this.rentalPolicyService.getDefaultPolicyForOrder();
    const turnaroundMinutes = rentalPolicy?.turnaroundMinutes ?? 60;
    const blockedEndDate = this.addMinutes(endDate, turnaroundMinutes);
    await this.storeBusinessHoursService.assertRentalTimeWithinBusinessHours(startDate, endDate);
    await this.storeClosureService.assertNoClosureOverlap(startDate, endDate);
    return { blockedEndDate, turnaroundMinutes };
  }

  private async getAvailabilityCounts(productIds: string[], startDate: Date, blockedEndDate: Date, excludeOrderId?: string) {
    if (productIds.length === 0) {
      return {
        assignable: new Map<string, number>(),
        booked: new Map<string, number>(),
        genericBooked: new Map<string, number>(),
      };
    }

    const [assignableRows, bookedRows, genericBookedRows] = await Promise.all([
      this.prisma.assetUnit.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds },
          deletedAt: null,
          isActive: true,
          status: { notIn: [AssetStatus.MAINTENANCE, AssetStatus.RETIRED, AssetStatus.LOST] },
          condition: { not: AssetCondition.LOST },
        },
        _count: { _all: true },
      }),
      this.prisma.rentalOrderItem.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds },
          deletedAt: null,
          order: this.blockingOrderWhere(startDate, blockedEndDate, excludeOrderId),
        },
        _count: { _all: true },
      }),
      this.prisma.rentalOrderItem.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds },
          assetUnitId: null,
          deletedAt: null,
          order: this.blockingOrderWhere(startDate, blockedEndDate, excludeOrderId),
        },
        _count: { _all: true },
      }),
    ]);

    return {
      assignable: new Map(assignableRows.map((row) => [row.productId, row._count._all])),
      booked: new Map(bookedRows.map((row) => [row.productId, row._count._all])),
      genericBooked: new Map(genericBookedRows.map((row) => [row.productId, row._count._all])),
    };
  }

  private async getBookedQuantityByProduct(
    productIds: string[],
    startDate: Date,
    blockedEndDate: Date,
    excludeOrderId?: string,
  ): Promise<Map<string, number>> {
    const uniqueProductIds = [...new Set(productIds)];

    if (uniqueProductIds.length === 0) {
      return new Map();
    }

    const bookedItems = await this.prisma.rentalOrderItem.groupBy({
      by: ['productId'],
      where: {
        deletedAt: null,
        productId: {
          in: uniqueProductIds,
        },
        order: this.blockingOrderWhere(startDate, blockedEndDate, excludeOrderId),
      },
      _count: {
        _all: true,
      },
    });

    return new Map(bookedItems.map((item) => [item.productId, item._count._all]));
  }

  private buildPagination(page: number, perPage: number, total: number, count: number) {
    const totalPage = Math.max(Math.ceil(total / perPage), 1);
    return {
      page,
      perPage,
      total,
      count,
      totalPage,
      prevPage: page > 1 ? page - 1 : undefined,
      nextPage: page < totalPage ? page + 1 : undefined,
    };
  }

  private countRequestedItemsByProduct(items: NormalizedRentalOrderItem[]): Map<string, number> {
    const requestedQuantityByProduct = new Map<string, number>();

    for (const item of items) {
      requestedQuantityByProduct.set(item.productId, (requestedQuantityByProduct.get(item.productId) ?? 0) + 1);
    }

    return requestedQuantityByProduct;
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }
}
