import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { AssetCondition, AssetStatus, OrderStatus, RentalOrderItemStatus } from '@generated/prisma/enums';
import { AssetUnitsService } from '../../asset-units/asset-units.service';
import { PrismaService } from '../../database/prisma.service';
import { ProductsService } from '../../products/products.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
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
} from '../dto/get-rental-order-availability.dto';
import { RENTAL_ORDER_ASSET_UNIT_INVALID, RENTAL_ORDER_PRODUCT_INVALID, RENTAL_ORDER_TIME_INVALID } from '@/libs/constants/error.constants';
import { normalizeSearchText } from '@/libs/utils/search-text.util';

export const BLOCKING_ORDER_STATUSES: OrderStatus[] = [OrderStatus.CONFIRMED, OrderStatus.RENTING, OrderStatus.DISPUTED];

export type SystemSettingsForOrder = Awaited<ReturnType<SystemSettingsService['getDefaultSettingsForOrder']>>;

export type NormalizedRentalOrderItem = {
  id?: string;
  productId: string;
  assetUnitId: string;
  note?: string | null;
};

type AvailabilityProductInventoryRow = {
  productId: string;
  name: string;
  sku: string;
  dailyPrice: Prisma.Decimal;
  halfDayPrice: Prisma.Decimal;
  hourlyOveragePrice: Prisma.Decimal | null;
  depositAmount: Prisma.Decimal;
  total: bigint | number;
  reserved: bigint | number;
  available: bigint | number;
  totalRows: bigint | number;
};

type AvailabilityAssetRow = {
  assetUnitId: string;
  serialNumber: string;
  status: AssetStatus;
  condition: AssetCondition;
  productId: string;
  productName: string;
  productSku: string;
  productDailyPrice: Prisma.Decimal;
  productHalfDayPrice: Prisma.Decimal;
  productHourlyOveragePrice: Prisma.Decimal | null;
  productDepositAmount: Prisma.Decimal;
  availability: AssetAvailabilityState;
  reasonCode: AssetAvailabilityReason | null;
  conflictBlockedEndDate: Date | null;
  totalRows: bigint | number;
};

@Injectable()
export class RentalOrderAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly assetUnitsService: AssetUnitsService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly storeBusinessHoursService: StoreBusinessHoursService,
    private readonly storeClosureService: StoreClosureService,
  ) {}

  async checkRentalOrderAvailability(dto: CheckRentalOrderAvailabilityDto): Promise<RentalOrderAvailabilityOutDto> {
    return this.evaluateAvailability({
      startDate: dto.startDate,
      endDate: dto.endDate,
      items: this.normalizeItems(dto.items),
      excludeOrderId: dto.excludeOrderId,
    });
  }

  async getAvailabilityProducts(dto: GetAvailabilityProductsDto): Promise<AvailabilityProductsOutDto> {
    const { blockedEndDate } = await this.validateAvailabilityWindow(dto.startDate, dto.endDate);
    const searchText = normalizeSearchText(dto.search);
    const rows = await this.getAvailabilityProductRows(dto, blockedEndDate, searchText);
    const productIds = rows.map((row) => row.productId);
    const rentalPriceTiers = productIds.length
      ? await this.prisma.productRentalPriceTier.findMany({
          where: {
            productId: { in: productIds },
            deletedAt: null,
          },
          select: {
            id: true,
            productId: true,
            minDays: true,
            maxDays: true,
            dailyPrice: true,
            name: true,
          },
          orderBy: [{ minDays: 'asc' }, { id: 'asc' }],
        })
      : [];
    const tiersByProduct = new Map<string, typeof rentalPriceTiers>();
    for (const tier of rentalPriceTiers) {
      tiersByProduct.set(tier.productId, [...(tiersByProduct.get(tier.productId) ?? []), tier]);
    }
    const total = rows.length ? Number(rows[0].totalRows) : 0;
    const items = rows.map((row) => ({
      productId: row.productId,
      name: row.name,
      sku: row.sku,
      dailyPrice: Number(row.dailyPrice),
      halfDayPrice: Number(row.halfDayPrice),
      hourlyOveragePrice: Number(row.hourlyOveragePrice ?? 0),
      rentalPriceTiers: (tiersByProduct.get(row.productId) ?? []).map((tier) => ({
        id: tier.id,
        minDays: tier.minDays,
        maxDays: tier.maxDays,
        dailyPrice: Number(tier.dailyPrice),
        name: tier.name,
        sortOrder: 0,
      })),
      depositAmount: Number(row.depositAmount ?? 0),
      inventory: {
        total: Number(row.total),
        reserved: Number(row.reserved),
        available: Number(row.available),
      },
    }));

    return {
      items,
      pagination: this.buildPagination(dto.page, dto.perPage, total, items.length),
      startDate: dto.startDate,
      endDate: dto.endDate,
      blockedEndDate,
    };
  }

  async getAvailabilityAssets(dto: GetAvailabilityAssetsDto): Promise<AvailabilityAssetsOutDto> {
    const { blockedEndDate, bookingHoldPricePerUnit } = await this.validateAvailabilityWindow(dto.startDate, dto.endDate);
    const selectedProduct = dto.productId
      ? await this.prisma.product.findFirst({
          where: { id: dto.productId, deletedAt: null, isActive: true },
          select: {
            id: true,
          },
        })
      : null;
    if (dto.productId && !selectedProduct) throw new BadRequestException(RENTAL_ORDER_PRODUCT_INVALID);

    const searchText = normalizeSearchText(dto.search);
    const [assetRows, counts] = await Promise.all([
      this.getAvailabilityAssetRows(dto, blockedEndDate, searchText),
      dto.productId
        ? this.getAvailabilityCounts([dto.productId], dto.startDate, blockedEndDate, dto.excludeOrderId)
        : Promise.resolve({
            assignable: new Map<string, number>(),
            booked: new Map<string, number>(),
            genericBooked: new Map<string, number>(),
          }),
    ]);
    const productIds = [...new Set(assetRows.map((asset) => asset.productId))];
    const rentalPriceTiers = productIds.length
      ? await this.prisma.productRentalPriceTier.findMany({
          where: {
            productId: { in: productIds },
            deletedAt: null,
          },
          select: {
            id: true,
            productId: true,
            minDays: true,
            maxDays: true,
            dailyPrice: true,
            name: true,
          },
          orderBy: [{ minDays: 'asc' }, { id: 'asc' }],
        })
      : [];
    const tiersByProduct = new Map<string, typeof rentalPriceTiers>();
    for (const tier of rentalPriceTiers) {
      tiersByProduct.set(tier.productId, [...(tiersByProduct.get(tier.productId) ?? []), tier]);
    }
    const productById = new Map(
      assetRows.map((asset) => [
        asset.productId,
        {
          productId: asset.productId,
          name: asset.productName,
          sku: asset.productSku,
          dailyPrice: Number(asset.productDailyPrice),
          halfDayPrice: Number(asset.productHalfDayPrice),
          hourlyOveragePrice: Number(asset.productHourlyOveragePrice ?? 0),
          rentalPriceTiers: (tiersByProduct.get(asset.productId) ?? []).map((tier) => ({
            id: tier.id,
            minDays: tier.minDays,
            maxDays: tier.maxDays,
            dailyPrice: Number(tier.dailyPrice),
            name: tier.name,
            sortOrder: 0,
          })),
          depositAmount: Number(asset.productDepositAmount ?? 0),
        },
      ]),
    );
    const total = assetRows.length ? Number(assetRows[0].totalRows) : 0;
    const items = assetRows.map((asset) => ({
      assetUnitId: asset.assetUnitId,
      serialNumber: asset.serialNumber,
      status: asset.status,
      condition: asset.condition,
      availability: asset.availability,
      reasonCode: asset.reasonCode,
      conflictBlockedEndDate: asset.conflictBlockedEndDate,
      product: productById.get(asset.productId)!,
    }));
    const availableQuantity = dto.productId
      ? Math.max((counts.assignable.get(dto.productId) ?? 0) - (counts.booked.get(dto.productId) ?? 0), 0)
      : await this.countAvailableAssetRows(dto, blockedEndDate);

    return {
      items,
      pagination: this.buildPagination(dto.page, dto.perPage, total, items.length),
      availableQuantity,
      selectionLimit: availableQuantity,
      blockedEndDate,
      bookingHoldAmountPerUnit: Number(bookingHoldPricePerUnit),
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
          where: this.rentalOrderItemOverlapWhere({
            assetUnitIds,
            startDate: dto.startDate,
            blockedEndDate: dto.endDate,
            excludeOrderId: dto.excludeOrderId,
          }),
          select: {
            assetUnitId: true,
            startDate: true,
            endDate: true,
            blockedEndDate: true,
            order: {
              select: {
                id: true,
                code: true,
                status: true,
                customerSnapshot: true,
              },
            },
          },
          orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
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
          customerName: this.getCustomerNameFromSnapshot(row.order.customerSnapshot),
          startDate: row.startDate,
          endDate: row.endDate,
          blockedEndDate: row.blockedEndDate,
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
    systemSettings?: SystemSettingsForOrder;
    bookingBufferTimeMinutes?: number;
  }): Promise<RentalOrderAvailabilityOutDto> {
    this.validateRentalTime(params.startDate, params.endDate);
    this.validateRequestedItems(params.items);

    const bookingBufferTimeMinutes = params.bookingBufferTimeMinutes ?? params.systemSettings?.bookingBufferTimeMinutes;
    const systemSettings =
      bookingBufferTimeMinutes === undefined ? await this.systemSettingsService.getDefaultSettingsForOrder() : params.systemSettings;
    const effectiveBookingBufferTimeMinutes = bookingBufferTimeMinutes ?? systemSettings?.bookingBufferTimeMinutes ?? 60;
    const blockedEndDate = this.addMinutes(params.endDate, effectiveBookingBufferTimeMinutes);

    await this.storeBusinessHoursService.assertRentalTimeWithinBusinessHours(params.startDate, params.endDate);
    await this.storeClosureService.assertNoClosureOverlap(params.startDate, params.endDate);

    const productIds = [...new Set(params.items.map((item) => item.productId))];
    const assetUnitIds = params.items.map((item) => item.assetUnitId);
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
      const assetUnit = assetUnitsById.get(item.assetUnitId);
      if (!assetUnit || assetUnit.productId !== item.productId) {
        throw new BadRequestException(RENTAL_ORDER_ASSET_UNIT_INVALID);
      }
    }

    const unavailableItems: RentalOrderUnavailableItemDto[] = [];

    for (const item of params.items) {
      if (bookedAssetUnitIds.has(item.assetUnitId)) {
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
      turnaroundMinutes: effectiveBookingBufferTimeMinutes,
      unavailableItems,
    };
  }

  normalizeItems(items: CheckRentalOrderAvailabilityItemDto[]): NormalizedRentalOrderItem[] {
    return items.flatMap((item) => {
      const assetUnitIds = item.assetUnitIds ?? [];

      if (assetUnitIds.length !== item.quantity) {
        throw new BadRequestException(RENTAL_ORDER_ASSET_UNIT_INVALID);
      }

      return assetUnitIds.map((assetUnitId) => ({
        productId: item.productId,
        assetUnitId,
      }));
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
      where: this.rentalOrderItemOverlapWhere({
        assetUnitIds: uniqueAssetUnitIds,
        startDate,
        blockedEndDate,
        excludeOrderId,
      }),
      select: {
        assetUnitId: true,
      },
    });

    return new Set(bookedItems.map((item) => item.assetUnitId));
  }

  private rentalOrderItemOverlapWhere(params: {
    assetUnitIds?: string[];
    productIds?: string[];
    startDate: Date;
    blockedEndDate: Date;
    excludeOrderId?: string;
  }): Prisma.RentalOrderItemWhereInput {
    return {
      deletedAt: null,
      status: RentalOrderItemStatus.ACTIVE,
      ...(params.assetUnitIds && {
        assetUnitId: {
          in: params.assetUnitIds,
        },
      }),
      ...(params.productIds && {
        productId: {
          in: params.productIds,
        },
      }),
      ...(params.excludeOrderId && {
        orderId: {
          not: params.excludeOrderId,
        },
      }),
      startDate: {
        lt: params.blockedEndDate,
      },
      blockedEndDate: {
        gt: params.startDate,
      },
      order: {
        deletedAt: null,
        status: {
          in: BLOCKING_ORDER_STATUSES,
        },
      },
    };
  }

  private async validateAvailabilityWindow(startDate: Date, endDate: Date) {
    this.validateRentalTime(startDate, endDate);
    const settings = await this.systemSettingsService.getDefaultSettingsForOrder();
    const bookingBufferTimeMinutes = settings.bookingBufferTimeMinutes ?? 60;
    const bookingHoldPricePerUnit = Number(settings.bookingHoldPricePerUnit);
    const blockedEndDate = this.addMinutes(endDate, bookingBufferTimeMinutes);
    await this.storeBusinessHoursService.assertRentalTimeWithinBusinessHours(startDate, endDate);
    await this.storeClosureService.assertNoClosureOverlap(startDate, endDate);
    return { blockedEndDate, bookingBufferTimeMinutes, bookingHoldPricePerUnit };
  }

  private async getAvailabilityCounts(productIds: string[], startDate: Date, blockedEndDate: Date, excludeOrderId?: string) {
    if (productIds.length === 0) {
      return {
        assignable: new Map<string, number>(),
        booked: new Map<string, number>(),
        genericBooked: new Map<string, number>(),
      };
    }

    const [assignableRows, bookedRows] = await Promise.all([
      this.prisma.assetUnit.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds },
          deletedAt: null,
          isActive: true,
          status: AssetStatus.AVAILABLE,
          condition: { not: AssetCondition.LOST },
        },
        _count: { _all: true },
      }),
      this.prisma.rentalOrderItem.groupBy({
        by: ['productId'],
        where: {
          ...this.rentalOrderItemOverlapWhere({
            productIds,
            startDate,
            blockedEndDate,
            excludeOrderId,
          }),
          assetUnit: {
            deletedAt: null,
            isActive: true,
            status: AssetStatus.AVAILABLE,
            condition: { not: AssetCondition.LOST },
          },
        },
        _count: { _all: true },
      }),
    ]);

    return {
      assignable: new Map(assignableRows.map((row) => [row.productId, row._count._all])),
      booked: new Map(bookedRows.map((row) => [row.productId, row._count._all])),
      genericBooked: new Map<string, number>(),
    };
  }

  private async getAvailabilityAssetRows(dto: GetAvailabilityAssetsDto, blockedEndDate: Date, searchText?: string): Promise<AvailabilityAssetRow[]> {
    const skip = (dto.page - 1) * dto.perPage;
    const availabilityFilter =
      dto.availability === AvailabilityFilter.AVAILABLE
        ? Prisma.sql`WHERE "availability" = 'AVAILABLE'`
        : dto.availability === AvailabilityFilter.UNAVAILABLE
          ? Prisma.sql`WHERE "availability" <> 'AVAILABLE'`
          : Prisma.empty;
    const searchFilter = searchText ? Prisma.sql`AND au."searchText" LIKE ${`%${searchText}%`}` : Prisma.empty;
    const productFilter = dto.productId ? Prisma.sql`AND au."productId" = ${dto.productId}::uuid` : Prisma.empty;
    const excludeOrderFilter = dto.excludeOrderId ? Prisma.sql`AND roi."orderId" <> ${dto.excludeOrderId}::uuid` : Prisma.empty;

    return this.prisma.$queryRaw<AvailabilityAssetRow[]>`
      WITH base_assets AS (
        SELECT
          au."id",
          au."serialNumber",
          au."status",
          au."condition",
          au."isActive",
          p."id" AS "productId",
          p."name" AS "productName",
          p."sku" AS "productSku",
          p."dailyPrice" AS "productDailyPrice",
          p."halfDayPrice" AS "productHalfDayPrice",
          p."hourlyOveragePrice" AS "productHourlyOveragePrice",
          p."depositAmount" AS "productDepositAmount"
        FROM "AssetUnit" au
        INNER JOIN "Product" p ON p."id" = au."productId"
          AND p."deletedAt" IS NULL
          AND p."isActive" = true
        WHERE au."deletedAt" IS NULL
          AND au."isActive" = true
          ${productFilter}
          ${searchFilter}
      ),
      conflicts AS (
        SELECT
          roi."assetUnitId",
          MAX(roi."blockedEndDate") AS "conflictBlockedEndDate"
        FROM "RentalOrderItem" roi
        INNER JOIN "RentalOrder" ro ON ro."id" = roi."orderId"
        INNER JOIN base_assets ba ON ba."id" = roi."assetUnitId"
        WHERE roi."deletedAt" IS NULL
          AND roi."status" = 'ACTIVE'
          AND ro."deletedAt" IS NULL
          AND ro."status" IN ('CONFIRMED', 'RENTING', 'DISPUTED')
          AND roi."startDate" < ${blockedEndDate}
          AND roi."blockedEndDate" > ${dto.startDate}
          ${excludeOrderFilter}
        GROUP BY roi."assetUnitId"
      ),
      classified_assets AS (
        SELECT
          ba."id" AS "assetUnitId",
          ba."serialNumber",
          ba."status",
          ba."condition",
          ba."productId",
          ba."productName",
          ba."productSku",
          ba."productDailyPrice",
          ba."productHalfDayPrice",
          ba."productHourlyOveragePrice",
          ba."productDepositAmount",
          CASE
            WHEN ba."isActive" = false THEN 'UNASSIGNABLE'
            WHEN ba."status" <> 'AVAILABLE' THEN 'UNASSIGNABLE'
            WHEN ba."condition" = 'LOST' THEN 'UNASSIGNABLE'
            WHEN c."assetUnitId" IS NOT NULL THEN 'BOOKED'
            ELSE 'AVAILABLE'
          END AS "availability",
          CASE
            WHEN ba."isActive" = false THEN 'INACTIVE'
            WHEN ba."status" = 'MAINTENANCE' THEN 'MAINTENANCE'
            WHEN ba."status" = 'LOST' OR ba."condition" = 'LOST' THEN 'LOST'
            WHEN c."assetUnitId" IS NOT NULL THEN 'BOOKED'
            ELSE NULL
          END AS "reasonCode",
          c."conflictBlockedEndDate"
        FROM base_assets ba
        LEFT JOIN conflicts c ON c."assetUnitId" = ba."id"
      ),
      filtered_assets AS (
        SELECT *
        FROM classified_assets
        ${availabilityFilter}
      )
      SELECT
        *,
        COUNT(*) OVER()::int AS "totalRows"
      FROM filtered_assets
      ORDER BY "productName" ASC, "serialNumber" ASC, "assetUnitId" ASC
      LIMIT ${dto.perPage}
      OFFSET ${skip}
    `;
  }

  private async countAvailableAssetRows(dto: GetAvailabilityAssetsDto, blockedEndDate: Date): Promise<number> {
    const productFilter = dto.productId ? Prisma.sql`AND au."productId" = ${dto.productId}::uuid` : Prisma.empty;
    const excludeOrderFilter = dto.excludeOrderId ? Prisma.sql`AND roi."orderId" <> ${dto.excludeOrderId}::uuid` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<Array<{ available: number | bigint }>>`
      WITH operational_assets AS (
        SELECT au."id"
        FROM "AssetUnit" au
        INNER JOIN "Product" p ON p."id" = au."productId"
          AND p."deletedAt" IS NULL
          AND p."isActive" = true
        WHERE au."deletedAt" IS NULL
          AND au."isActive" = true
          AND au."status" = 'AVAILABLE'
          AND au."condition" <> 'LOST'
          ${productFilter}
      ),
      booked_assets AS (
        SELECT DISTINCT roi."assetUnitId"
        FROM "RentalOrderItem" roi
        INNER JOIN "RentalOrder" ro ON ro."id" = roi."orderId"
        INNER JOIN operational_assets oa ON oa."id" = roi."assetUnitId"
        WHERE roi."deletedAt" IS NULL
          AND roi."status" = 'ACTIVE'
          AND ro."deletedAt" IS NULL
          AND ro."status" IN ('CONFIRMED', 'RENTING', 'DISPUTED')
          AND roi."startDate" < ${blockedEndDate}
          AND roi."blockedEndDate" > ${dto.startDate}
          ${excludeOrderFilter}
      )
      SELECT GREATEST(
        (SELECT COUNT(*) FROM operational_assets) - (SELECT COUNT(*) FROM booked_assets),
        0
      )::int AS "available"
    `;

    return rows.length ? Number(rows[0].available) : 0;
  }

  private async getAvailabilityProductRows(
    dto: GetAvailabilityProductsDto,
    blockedEndDate: Date,
    searchText?: string,
  ): Promise<AvailabilityProductInventoryRow[]> {
    const skip = (dto.page - 1) * dto.perPage;
    const availabilityFilter =
      dto.availability === AvailabilityFilter.AVAILABLE
        ? Prisma.sql`WHERE "available" > 0`
        : dto.availability === AvailabilityFilter.UNAVAILABLE
          ? Prisma.sql`WHERE "available" = 0`
          : Prisma.empty;
    const searchFilter = searchText ? Prisma.sql`AND p."searchText" LIKE ${`%${searchText}%`}` : Prisma.empty;
    const excludeOrderFilter = dto.excludeOrderId ? Prisma.sql`AND roi."orderId" <> ${dto.excludeOrderId}::uuid` : Prisma.empty;

    return this.prisma.$queryRaw<AvailabilityProductInventoryRow[]>`
      WITH base_products AS (
        SELECT
          p."id",
          p."name",
          p."sku",
          p."dailyPrice",
          p."halfDayPrice",
          p."hourlyOveragePrice",
          p."depositAmount"
        FROM "Product" p
        WHERE p."deletedAt" IS NULL
          AND p."isActive" = true
          ${searchFilter}
      ),
      asset_counts AS (
        SELECT
          au."productId",
          COUNT(*)::int AS "total"
        FROM "AssetUnit" au
        INNER JOIN base_products bp ON bp."id" = au."productId"
        WHERE au."deletedAt" IS NULL
          AND au."isActive" = true
          AND au."status" = 'AVAILABLE'
          AND au."condition" <> 'LOST'
        GROUP BY au."productId"
      ),
      reservation_counts AS (
        SELECT
          roi."productId",
          COUNT(*)::int AS "reserved"
        FROM "RentalOrderItem" roi
        INNER JOIN "RentalOrder" ro ON ro."id" = roi."orderId"
        INNER JOIN base_products bp ON bp."id" = roi."productId"
        INNER JOIN "AssetUnit" au ON au."id" = roi."assetUnitId"
          AND au."deletedAt" IS NULL
          AND au."isActive" = true
          AND au."status" = 'AVAILABLE'
          AND au."condition" <> 'LOST'
        WHERE roi."deletedAt" IS NULL
          AND roi."status" = 'ACTIVE'
          AND ro."deletedAt" IS NULL
          AND ro."status" IN ('CONFIRMED', 'RENTING', 'DISPUTED')
          AND roi."startDate" < ${blockedEndDate}
          AND roi."blockedEndDate" > ${dto.startDate}
          ${excludeOrderFilter}
        GROUP BY roi."productId"
      ),
      inventory_products AS (
        SELECT
          bp."id" AS "productId",
          bp."name",
          bp."sku",
          bp."dailyPrice",
          bp."halfDayPrice",
          bp."hourlyOveragePrice",
          bp."depositAmount",
          COALESCE(ac."total", 0)::int AS "total",
          COALESCE(rc."reserved", 0)::int AS "reserved",
          GREATEST(COALESCE(ac."total", 0) - COALESCE(rc."reserved", 0), 0)::int AS "available"
        FROM base_products bp
        LEFT JOIN asset_counts ac ON ac."productId" = bp."id"
        LEFT JOIN reservation_counts rc ON rc."productId" = bp."id"
      ),
      filtered_products AS (
        SELECT *
        FROM inventory_products
        ${availabilityFilter}
      )
      SELECT
        *,
        COUNT(*) OVER()::int AS "totalRows"
      FROM filtered_products
      ORDER BY "name" ASC, "productId" ASC
      LIMIT ${dto.perPage}
      OFFSET ${skip}
    `;
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
        ...this.rentalOrderItemOverlapWhere({
          productIds: uniqueProductIds,
          startDate,
          blockedEndDate,
          excludeOrderId,
        }),
        assetUnit: {
          deletedAt: null,
          isActive: true,
          status: AssetStatus.AVAILABLE,
          condition: { not: AssetCondition.LOST },
        },
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

  private getCustomerNameFromSnapshot(snapshot: Prisma.JsonValue): string {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return '';
    }

    const customerName = snapshot.name;
    return typeof customerName === 'string' ? customerName : '';
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }
}

/**
 * Luong nghiep vu availability:
 *
 * 1. Nguoi dung chon thoi gian thue va danh sach item muon thue.
 *    Moi item tuong ung 1 AssetUnit cu the, tuc la 1 serial.
 *
 * 2. Service chuan hoa input:
 *    - startDate/endDate phai hop le.
 *    - assetUnitId phai ton tai.
 *    - moi item phai gan voi productId cua assetUnit do.
 *
 * 3. Service lay SystemSettings de tinh thoi gian bi block:
 *    - khach thue den endDate.
 *    - he thong cong them bookingBufferTimeMinutes.
 *    - blockedEndDate = endDate + bookingBufferTimeMinutes.
 *
 * 4. Rule quan trong nhat de biet 1 asset co bi trung lich khong:
 *    Hai khoang thoi gian bi xem la overlap khi:
 *    - itemCu.startDate < blockedEndDateMoi
 *    - itemCu.blockedEndDate > startDateMoi
 *
 * 5. Chi nhung RentalOrderItem dang ACTIVE moi giu may.
 *    Order cha cung phai dang o trang thai co tac dung giu lich:
 *    - CONFIRMED
 *    - RENTING
 *    - DISPUTED
 *
 * 6. CREATED/PENDING khong block asset.
 *    Khach tao don nhung chua thanh toan giu cho thi serial do van chua bi giu.
 *
 * 7. RETURNED/DONE/CANCELLED khong block asset.
 *    Don da ket thuc hoac da huy thi khong con anh huong den lich thue moi.
 *
 * 8. Cac man hinh su dung service nay:
 *    - checkRentalOrderAvailability: kiem tra danh sach item co dat duoc khong.
 *    - getAvailabilityProducts: xem moi product con bao nhieu may trong khoang ngay.
 *    - getAvailabilityAssets: xem tung serial nao con trong khoang ngay.
 *    - getAvailabilityTimeline: xem lich bi giu cua 1 asset/product.
 */
