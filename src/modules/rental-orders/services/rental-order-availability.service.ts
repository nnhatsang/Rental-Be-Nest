import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { AssetCondition, AssetStatus, RentalAllocationStatus } from '@generated/prisma/enums';
import { RENTAL_ORDER_TIME_INVALID } from '@/libs/constants/error.constants';
import { normalizeSearchText } from '@/libs/utils/search-text.util';
import { StoreBusinessHoursService } from '@/modules/store-business-hours/store-business-hours.service';
import { StoreClosureService } from '@/modules/store-closure/store-closure.service';
import { SystemSettingsService } from '@/modules/system-settings/system-settings.service';
import { PrismaService } from '@/modules/database/prisma.service';
import {
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
  GetAvailabilityProductsDto,
  GetAvailabilityTimelineDto,
} from '../dto/get-rental-order-availability.dto';

const BLOCKING_ALLOCATION_STATUSES: RentalAllocationStatus[] = [
  RentalAllocationStatus.REQUESTED,
  RentalAllocationStatus.RESERVED,
  RentalAllocationStatus.HANDED_OVER,
  RentalAllocationStatus.RETURNED,
];

export type RentalOrderRequestedItem = {
  productId: string;
  quantity: number;
  note?: string;
};

export type RentalOrderAutoAllocation = RentalOrderRequestedItem & {
  assetUnitIds: string[];
};

@Injectable()
export class RentalOrderAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly storeBusinessHoursService: StoreBusinessHoursService,
    private readonly storeClosureService: StoreClosureService,
  ) {}

  async checkRentalOrderAvailability(dto: CheckRentalOrderAvailabilityDto): Promise<RentalOrderAvailabilityOutDto> {
    const result = await this.selectAvailableAssets(dto);

    return {
      isAvailable: result.isAvailable,
      startDate: dto.startDate,
      endDate: dto.endDate,
      blockedEndDate: result.blockedEndDate,
      turnaroundMinutes: Math.round((result.blockedEndDate.getTime() - dto.endDate.getTime()) / 60_000),
      unavailableItems: result.unavailableItems,
    };
  }

  async selectAvailableAssets(input: {
    startDate: Date;
    endDate: Date;
    items: RentalOrderRequestedItem[];
    excludeOrderId?: string;
  }): Promise<{
    blockedEndDate: Date;
    isAvailable: boolean;
    unavailableItems: RentalOrderUnavailableItemDto[];
    allocations: RentalOrderAutoAllocation[];
  }> {
    const blockedEndDate = await this.validateWindow(input.startDate, input.endDate);
    const requestedByProduct = new Map<string, RentalOrderRequestedItem>();
    for (const item of input.items) {
      const existing = requestedByProduct.get(item.productId);
      requestedByProduct.set(item.productId, {
        productId: item.productId,
        quantity: (existing?.quantity ?? 0) + item.quantity,
        note: item.note ?? existing?.note,
      });
    }
    const requestedItems = [...requestedByProduct.values()];
    const productIds = requestedItems.map((item) => item.productId);
    const assets = await this.prisma.assetUnit.findMany({
      where: { productId: { in: productIds }, deletedAt: null, product: { isActive: true, deletedAt: null } },
      select: { id: true, productId: true, serialNumber: true, status: true, condition: true, isActive: true },
      orderBy: [{ productId: 'asc' }, { serialNumber: 'asc' }, { id: 'asc' }],
    });
    const conflicts = await this.findConflictingAllocations(assets.map((asset) => asset.id), input.startDate, blockedEndDate, input.excludeOrderId);
    const assetsByProduct = new Map<string, typeof assets>();
    for (const asset of assets) {
      const productAssets = assetsByProduct.get(asset.productId) ?? [];
      productAssets.push(asset);
      assetsByProduct.set(asset.productId, productAssets);
    }

    const unavailableItems: RentalOrderUnavailableItemDto[] = [];
    const allocations = requestedItems.map((item) => {
      const candidates = (assetsByProduct.get(item.productId) ?? []).filter(
        (asset) => asset.isActive && asset.status === AssetStatus.AVAILABLE && asset.condition !== AssetCondition.LOST && !conflicts.has(asset.id),
      );
      const assetUnitIds = candidates.slice(0, item.quantity).map((asset) => asset.id);
      if (assetUnitIds.length < item.quantity) {
        unavailableItems.push({ productId: item.productId, reason: 'NOT_ENOUGH_ASSETS_AVAILABLE' });
      }
      return { ...item, assetUnitIds };
    });

    return { blockedEndDate, isAvailable: unavailableItems.length === 0, unavailableItems, allocations };
  }

  async getAvailabilityProducts(dto: GetAvailabilityProductsDto): Promise<AvailabilityProductsOutDto> {
    const blockedEndDate = await this.validateWindow(dto.startDate, dto.endDate);
    const searchText = normalizeSearchText(dto.search);
    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(searchText ? { searchText: { contains: searchText } } : {}),
      },
      include: {
        rentalPriceTiers: { where: { deletedAt: null }, orderBy: [{ minDays: 'asc' }, { id: 'asc' }] },
        assetUnits: {
          where: { deletedAt: null },
          select: { id: true, status: true, condition: true, isActive: true },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const assetIds = products.flatMap((product) => product.assetUnits.map((asset) => asset.id));
    const conflicts = await this.findConflictingAllocations(assetIds, dto.startDate, blockedEndDate, dto.excludeOrderId);
    const availableProducts = products.map((product) => {
      const assignable = product.assetUnits.filter((asset) => asset.isActive && asset.status === AssetStatus.AVAILABLE && asset.condition !== AssetCondition.LOST);
      const available = assignable.filter((asset) => !conflicts.has(asset.id)).length;
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        dailyPrice: Number(product.dailyPrice),
        halfDayPrice: Number(product.halfDayPrice),
        hourlyOveragePrice: product.hourlyOveragePrice === null ? null : Number(product.hourlyOveragePrice),
        rentalPriceTiers: product.rentalPriceTiers.map((tier) => ({ ...tier, dailyPrice: Number(tier.dailyPrice), sortOrder: 0 })),
        depositAmount: Number(product.depositAmount),
        inventory: { total: assignable.length, reserved: assignable.length - available, available },
      };
    });
    const filtered = dto.availability === AvailabilityFilter.AVAILABLE
      ? availableProducts.filter((product) => product.inventory.available > 0)
      : dto.availability === AvailabilityFilter.UNAVAILABLE
        ? availableProducts.filter((product) => product.inventory.available === 0)
        : availableProducts;
    const items = filtered.slice((dto.page - 1) * dto.perPage, dto.page * dto.perPage);

    return {
      items,
      pagination: this.buildPagination(dto.page, dto.perPage, filtered.length, items.length),
      startDate: dto.startDate,
      endDate: dto.endDate,
      blockedEndDate,
    };
  }

  async getAvailabilityAssets(dto: GetAvailabilityAssetsDto): Promise<AvailabilityAssetsOutDto> {
    const blockedEndDate = await this.validateWindow(dto.startDate, dto.endDate);
    const settings = await this.systemSettingsService.getDefaultSettingsForOrder();
    const searchText = normalizeSearchText(dto.search);
    const assets = await this.prisma.assetUnit.findMany({
      where: {
        deletedAt: null,
        ...(dto.productId ? { productId: dto.productId } : {}),
        ...(searchText ? { searchText: { contains: searchText } } : {}),
      },
      include: {
        product: {
          include: {
            rentalPriceTiers: { where: { deletedAt: null }, orderBy: [{ minDays: 'asc' }, { id: 'asc' }] },
          },
        },
      },
      orderBy: [{ serialNumber: 'asc' }, { id: 'asc' }],
    });
    const conflicts = await this.findConflictingAllocations(assets.map((asset) => asset.id), dto.startDate, blockedEndDate, dto.excludeOrderId);
    const mapped = assets.map((asset) => {
      const conflict = conflicts.get(asset.id);
      const assignable = asset.isActive && asset.status === AssetStatus.AVAILABLE && asset.condition !== AssetCondition.LOST;
      const availability = !assignable ? AssetAvailabilityState.UNASSIGNABLE : conflict ? AssetAvailabilityState.BOOKED : AssetAvailabilityState.AVAILABLE;
      const reasonCode = !assignable
        ? asset.condition === AssetCondition.LOST ? AssetAvailabilityReason.LOST : asset.status === AssetStatus.MAINTENANCE ? AssetAvailabilityReason.MAINTENANCE : AssetAvailabilityReason.INACTIVE
        : conflict ? AssetAvailabilityReason.BOOKED : null;
      return {
        assetUnitId: asset.id,
        serialNumber: asset.serialNumber,
        status: asset.status,
        condition: asset.condition,
        availability,
        reasonCode,
        conflictBlockedEndDate: conflict?.blockedEndDate ?? null,
        product: {
          productId: asset.product.id,
          name: asset.product.name,
          sku: asset.product.sku,
          dailyPrice: Number(asset.product.dailyPrice),
          halfDayPrice: Number(asset.product.halfDayPrice),
          hourlyOveragePrice: asset.product.hourlyOveragePrice === null ? null : Number(asset.product.hourlyOveragePrice),
          rentalPriceTiers: asset.product.rentalPriceTiers.map((tier) => ({ ...tier, dailyPrice: Number(tier.dailyPrice), sortOrder: 0 })),
          depositAmount: Number(asset.product.depositAmount),
        },
      };
    });
    const filtered = dto.availability === AvailabilityFilter.AVAILABLE
      ? mapped.filter((asset) => asset.availability === AssetAvailabilityState.AVAILABLE)
      : dto.availability === AvailabilityFilter.UNAVAILABLE
        ? mapped.filter((asset) => asset.availability !== AssetAvailabilityState.AVAILABLE)
        : mapped;
    const items = filtered.slice((dto.page - 1) * dto.perPage, dto.page * dto.perPage);

    return {
      items,
      pagination: this.buildPagination(dto.page, dto.perPage, filtered.length, items.length),
      availableQuantity: mapped.filter((asset) => asset.availability === AssetAvailabilityState.AVAILABLE).length,
      selectionLimit: dto.productId ? mapped.filter((asset) => asset.availability === AssetAvailabilityState.AVAILABLE).length : 0,
      blockedEndDate,
      bookingHoldAmountPerUnit: Number(settings.bookingHoldPricePerUnit),
    };
  }

  async getAvailabilityTimeline(dto: GetAvailabilityTimelineDto): Promise<AvailabilityTimelineOutDto> {
    const blockedEndDate = await this.validateWindow(dto.startDate, dto.endDate);
    const assets = await this.prisma.assetUnit.findMany({
      where: { deletedAt: null },
      include: {
        product: { select: { name: true, sku: true } },
        assetAllocations: {
          where: {
            status: { in: BLOCKING_ALLOCATION_STATUSES },
            startDate: { lt: blockedEndDate },
            blockedEndDate: { gt: dto.startDate },
          },
          include: { orderLine: { include: { order: { select: { id: true, code: true, status: true, customerSnapshot: true } } } } },
          orderBy: { startDate: 'asc' },
        },
      },
      orderBy: [{ serialNumber: 'asc' }, { id: 'asc' }],
    });
    const items = assets.slice((dto.page - 1) * dto.perPage, dto.page * dto.perPage).map((asset) => ({
      assetUnitId: asset.id,
      serialNumber: asset.serialNumber,
      productName: asset.product.name,
      sku: asset.product.sku,
      status: asset.status,
      condition: asset.condition,
      blocks: asset.assetAllocations.map((allocation) => ({
        orderId: allocation.orderLine.order.id,
        orderCode: allocation.orderLine.order.code,
        status: allocation.orderLine.order.status,
        customerName: this.getCustomerName(allocation.orderLine.order.customerSnapshot),
        startDate: allocation.startDate,
        endDate: allocation.endDate,
        blockedEndDate: allocation.blockedEndDate,
      })),
    }));

    return {
      items,
      pagination: this.buildPagination(dto.page, dto.perPage, assets.length, items.length),
      startDate: dto.startDate,
      endDate: dto.endDate,
    };
  }

  async getBlockedEndDate(startDate: Date, endDate: Date): Promise<Date> {
    return this.validateWindow(startDate, endDate);
  }

  private async validateWindow(startDate: Date, endDate: Date): Promise<Date> {
    if (startDate >= endDate) {
      throw new BadRequestException(RENTAL_ORDER_TIME_INVALID);
    }
    const settings = await this.systemSettingsService.getDefaultSettingsForOrder();
    const maxRentalTimeMs = settings.maxRentalTimeDays * 86_400_000;
    if (endDate.getTime() - startDate.getTime() > maxRentalTimeMs) {
      throw new BadRequestException(RENTAL_ORDER_TIME_INVALID);
    }
    await this.storeBusinessHoursService.assertRentalTimeWithinBusinessHours(startDate, endDate);
    await this.storeClosureService.assertNoClosureOverlap(startDate, endDate);
    return new Date(endDate.getTime() + settings.bookingBufferTimeMinutes * 60_000);
  }

  private async findConflictingAllocations(
    assetUnitIds: string[],
    startDate: Date,
    blockedEndDate: Date,
    excludeOrderId?: string,
  ): Promise<Map<string, { blockedEndDate: Date }>> {
    if (assetUnitIds.length === 0) return new Map();
    const allocations = await this.prisma.rentalAssetAllocation.findMany({
      where: {
        assetUnitId: { in: assetUnitIds },
        status: { in: BLOCKING_ALLOCATION_STATUSES },
        startDate: { lt: blockedEndDate },
        blockedEndDate: { gt: startDate },
        ...(excludeOrderId ? { orderLine: { orderId: { not: excludeOrderId } } } : {}),
      },
      select: { assetUnitId: true, blockedEndDate: true },
      orderBy: { blockedEndDate: 'asc' },
    });
    const result = new Map<string, { blockedEndDate: Date }>();
    for (const allocation of allocations) {
      result.set(allocation.assetUnitId, { blockedEndDate: allocation.blockedEndDate });
    }
    return result;
  }

  private buildPagination(page: number, perPage: number, total: number, count: number) {
    const totalPage = Math.max(Math.ceil(total / perPage), 1);
    return { page, perPage, total, count, totalPage, prevPage: page > 1 ? page - 1 : undefined, nextPage: page < totalPage ? page + 1 : undefined };
  }

  private getCustomerName(snapshot: Prisma.JsonValue): string {
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) && 'name' in snapshot) {
      return String(snapshot.name ?? '');
    }
    return '';
  }
}
