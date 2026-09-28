import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { AssetCondition, AssetStatus } from '@generated/prisma/enums';
import { RENTAL_ORDER_TIME_INVALID } from '@/libs/constants/error.constants';
import { StoreBusinessHoursService } from '@/modules/store-business-hours/store-business-hours.service';
import { StoreClosureService } from '@/modules/store-closure/store-closure.service';
import { SystemSettingsService } from '@/modules/system-settings/system-settings.service';
import { normalizeSearchText } from '@/libs/utils/search-text.util';
import { PrismaService } from '@/modules/database/prisma.service';
import { BLOCKING_ALLOCATION_STATUSES } from '../rental-orders/domain/rental-allocation.constants';
import { AvailabilityGanttOutDto } from './dto/availability-gantt-out.dto';
import { GetAvailabilityGanttDto } from './dto/get-availability-gantt.dto';
import { AvailabilityFilter, AvailabilityProductsOutDto, GetAvailabilityProductsDto } from './dto/get-availability-products.dto';

const MAX_SCHEDULE_RANGE_DAYS = 366;

type AvailabilityGanttCursor = {
  productId: string;
};

@Injectable()
export class AvailabilityScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly storeBusinessHoursService: StoreBusinessHoursService,
    private readonly storeClosureService: StoreClosureService,
  ) {}

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
      const assignable = product.assetUnits.filter(
        (asset) => asset.isActive && asset.status === AssetStatus.AVAILABLE && asset.condition !== AssetCondition.LOST,
      );
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

    const filtered =
      dto.availability === AvailabilityFilter.AVAILABLE
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

  async getGantt(dto: GetAvailabilityGanttDto): Promise<AvailabilityGanttOutDto> {
    this.validateRange(dto.startDate, dto.endDate);

    const limit = dto.limit;
    const productWhere = this.buildProductWhere(dto);
    const cursorProductId = this.decodeCursor(dto.cursor);
    const allocationWhere = {
      status: { in: BLOCKING_ALLOCATION_STATUSES },
      startDate: { lt: dto.endDate },
      blockedEndDate: { gt: dto.startDate },
      orderLine: { order: { deletedAt: null } },
    } satisfies Prisma.RentalAssetAllocationWhereInput;

    const [products, totalProducts, totalAssets, scheduledAssets, unassignableAssets] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: productWhere,
        ...(cursorProductId ? { cursor: { id: cursorProductId }, skip: 1 } : {}),
        take: limit + 1,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          sku: true,
          assetUnits: {
            where: { deletedAt: null },
            orderBy: [{ serialNumber: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              serialNumber: true,
              status: true,
              condition: true,
              isActive: true,
              assetAllocations: {
                where: allocationWhere,
                orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
                select: {
                  status: true,
                  startDate: true,
                  endDate: true,
                  blockedEndDate: true,
                  orderLine: {
                    select: {
                      order: {
                        select: {
                          id: true,
                          code: true,
                          status: true,
                          customerSnapshot: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.product.count({ where: productWhere }),
      this.prisma.assetUnit.count({ where: { deletedAt: null, product: productWhere } }),
      this.prisma.assetUnit.count({
        where: {
          deletedAt: null,
          product: productWhere,
          assetAllocations: { some: allocationWhere },
        },
      }),
      this.prisma.assetUnit.count({
        where: {
          deletedAt: null,
          product: productWhere,
          OR: [{ isActive: false }, { status: { not: AssetStatus.AVAILABLE } }, { condition: AssetCondition.LOST }],
        },
      }),
    ]);

    const hasNext = products.length > limit;
    const page = hasNext ? products.slice(0, limit) : products;
    const lastProduct = page.at(-1);

    return {
      items: page.map((product) => ({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        assetUnits: product.assetUnits.map((asset) => ({
          assetUnitId: asset.id,
          serialNumber: asset.serialNumber,
          status: asset.status,
          condition: asset.condition,
          isActive: asset.isActive,
          blocks: asset.assetAllocations.map((allocation) => ({
            orderId: allocation.orderLine.order.id,
            orderCode: allocation.orderLine.order.code,
            orderStatus: allocation.orderLine.order.status,
            allocationStatus: allocation.status,
            customerName: this.getCustomerName(allocation.orderLine.order.customerSnapshot),
            startDate: allocation.startDate,
            endDate: allocation.endDate,
            blockedEndDate: allocation.blockedEndDate,
          })),
        })),
      })),
      pagination: {
        nextCursor: hasNext && lastProduct ? this.encodeCursor({ productId: lastProduct.id }) : null,
        hasNext,
        limit,
      },
      startDate: dto.startDate,
      endDate: dto.endDate,
      summary: {
        totalProducts,
        totalAssets,
        scheduledAssets,
        freeAssets: Math.max(0, totalAssets - scheduledAssets),
        unassignableAssets,
      },
    };
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

  private buildProductWhere(dto: GetAvailabilityGanttDto): Prisma.ProductWhereInput {
    const searchText = normalizeSearchText(dto.search);
    if (!searchText) {
      return { ...(dto.productId ? { id: dto.productId } : {}), deletedAt: null };
    }

    return {
      ...(dto.productId ? { id: dto.productId } : {}),
      deletedAt: null,
      OR: [
        { searchText: { contains: searchText } },
        {
          assetUnits: {
            some: {
              deletedAt: null,
              searchText: { contains: searchText },
            },
          },
        },
        {
          assetUnits: {
            some: {
              deletedAt: null,
              assetAllocations: {
                some: {
                  status: { in: BLOCKING_ALLOCATION_STATUSES },
                  startDate: { lt: dto.endDate },
                  blockedEndDate: { gt: dto.startDate },
                  orderLine: { order: { deletedAt: null, searchText: { contains: searchText } } },
                },
              },
            },
          },
        },
      ],
    };
  }

  private validateRange(startDate: Date, endDate: Date): void {
    if (startDate >= endDate) {
      throw new BadRequestException('Khoảng thời gian Gantt không hợp lệ.');
    }

    const rangeDays = (endDate.getTime() - startDate.getTime()) / 86_400_000;
    if (rangeDays > MAX_SCHEDULE_RANGE_DAYS) {
      throw new BadRequestException(`Khoảng thời gian xem lịch không được vượt quá ${MAX_SCHEDULE_RANGE_DAYS} ngày.`);
    }
  }

  private encodeCursor(cursor: AvailabilityGanttCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor?: string): string | undefined {
    if (!cursor) return undefined;

    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<AvailabilityGanttCursor>;
      if (!parsed.productId || typeof parsed.productId !== 'string') throw new Error('invalid cursor');
      return parsed.productId;
    } catch {
      throw new BadRequestException('Cursor Gantt không hợp lệ hoặc đã hết hạn.');
    }
  }

  private getCustomerName(snapshot: Prisma.JsonValue): string {
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) && 'name' in snapshot) {
      return String(snapshot.name ?? '');
    }
    return 'Chưa có tên khách';
  }
}
