import { BadRequestException, Injectable } from '@nestjs/common';
import { AssetCondition, AssetStatus } from '@generated/prisma/enums';
import { RENTAL_ORDER_TIME_INVALID } from '@/libs/constants/error.constants';
import { StoreBusinessHoursService } from '@/modules/store-business-hours/store-business-hours.service';
import { StoreClosureService } from '@/modules/store-closure/store-closure.service';
import { SystemSettingsService } from '@/modules/system-settings/system-settings.service';
import { PrismaService } from '@/modules/database/prisma.service';
import { BLOCKING_ALLOCATION_STATUSES } from '../domain/rental-allocation.constants';

export type RentalOrderRequestedItem = {
  productId: string;
  quantity: number;
  note?: string;
};

export type RentalOrderUnavailableItem = {
  productId: string;
  productName: string;
  requestedQuantity: number;
  availableQuantity: number;
  reasonCode: string;
  message: string;
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

  async selectAvailableAssets(input: { startDate: Date; endDate: Date; items: RentalOrderRequestedItem[]; excludeOrderId?: string }): Promise<{
    blockedEndDate: Date;
    isAvailable: boolean;
    unavailableItems: RentalOrderUnavailableItem[];
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
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } });
    const productNameById = new Map(products.map((product) => [product.id, product.name]));
    const assets = await this.prisma.assetUnit.findMany({
      where: { productId: { in: productIds }, deletedAt: null, product: { isActive: true, deletedAt: null } },
      select: { id: true, productId: true, serialNumber: true, status: true, condition: true, isActive: true },
      orderBy: [{ productId: 'asc' }, { serialNumber: 'asc' }, { id: 'asc' }],
    });
    const conflicts = await this.findConflictingAllocations(
      assets.map((asset) => asset.id),
      input.startDate,
      blockedEndDate,
      input.excludeOrderId,
    );
    const assetsByProduct = new Map<string, typeof assets>();
    for (const asset of assets) {
      const productAssets = assetsByProduct.get(asset.productId) ?? [];
      productAssets.push(asset);
      assetsByProduct.set(asset.productId, productAssets);
    }

    const unavailableItems: RentalOrderUnavailableItem[] = [];
    const allocations = requestedItems.map((item) => {
      const candidates = (assetsByProduct.get(item.productId) ?? []).filter(
        (asset) => asset.isActive && asset.status === AssetStatus.AVAILABLE && asset.condition !== AssetCondition.LOST && !conflicts.has(asset.id),
      );
      const assetUnitIds = candidates.slice(0, item.quantity).map((asset) => asset.id);
      if (assetUnitIds.length < item.quantity) {
        const availableQuantity = candidates.length;
        unavailableItems.push({
          productId: item.productId,
          productName: productNameById.get(item.productId) ?? item.productId,
          requestedQuantity: item.quantity,
          availableQuantity,
          reasonCode: 'NOT_ENOUGH_ASSETS_AVAILABLE',
          message:
            availableQuantity > 0
              ? `Chỉ còn ${availableQuantity} máy trống trong khoảng thời gian đã chọn`
              : 'Không còn máy trống trong khoảng thời gian đã chọn',
        });
      }
      return { ...item, assetUnitIds };
    });

    return { blockedEndDate, isAvailable: unavailableItems.length === 0, unavailableItems, allocations };
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
}
