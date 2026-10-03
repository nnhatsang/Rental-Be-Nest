import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import {
  AssetCondition,
  AssetStatus,
  HandoverStatus,
  OrderStatus,
  PaymentDirection,
  PaymentTransactionStatus,
  RentalAllocationStatus,
  RentalRefundStatus,
  ReturnStatus,
} from '@generated/prisma/enums';
import { DASHBOARD_DATE_RANGE_INVALID, DASHBOARD_TIMEZONE_INVALID } from '@/libs/constants/error.constants';
import { PrismaService } from '@/modules/database/prisma.service';
import { BLOCKING_ALLOCATION_STATUSES } from '@/modules/rental-orders/domain/rental-allocation.constants';
import {
  DashboardAttentionPriority,
  DashboardAttentionType,
  DashboardScheduleType,
  DashboardTrendGroupBy,
  GetDashboardAttentionQueryDto,
  GetDashboardOperationsDto,
  GetDashboardTrendsDto,
} from './dto/get-dashboard.dto';
import {
  DashboardAttentionOutDto,
  DashboardOperationsOverviewOutDto,
  DashboardScheduleItemOutDto,
  DashboardTopAssetOutDto,
  DashboardTopProductOutDto,
  DashboardTrendItemOutDto,
  DashboardTrendsOutDto,
} from './dto/dashboard-out.dto';

const MAX_DASHBOARD_RANGE_DAYS = 366;
const DASHBOARD_DATE_BASIS = 'RENTAL_PERIOD';

type DashboardDateRangeQuery = {
  fromDate: Date;
  toDate: Date;
  timezone: string;
  includeCancelled: boolean;
};

const attentionOrderSelect = {
  id: true,
  code: true,
  status: true,
  handoverStatus: true,
  returnStatus: true,
  settlementStatus: true,
  customerSnapshot: true,
  startDate: true,
  endDate: true,
  actualReturnDate: true,
  amountDueBeforeHandover: true,
  refundDue: true,
  paymentTransactions: {
    where: { direction: PaymentDirection.INBOUND },
    select: { status: true },
  },
  refunds: {
    select: { status: true },
  },
  lines: {
    select: {
      quantity: true,
      product: { select: { name: true } },
    },
  },
} as const satisfies Prisma.RentalOrderSelect;

type AttentionOrderRecord = Prisma.RentalOrderGetPayload<{ select: typeof attentionOrderSelect }>;

const scheduleOrderSelect = {
  id: true,
  code: true,
  status: true,
  customerSnapshot: true,
  startDate: true,
  endDate: true,
  lines: {
    select: {
      quantity: true,
      product: { select: { name: true } },
    },
  },
} as const satisfies Prisma.RentalOrderSelect;

type ScheduleOrderRecord = Prisma.RentalOrderGetPayload<{ select: typeof scheduleOrderSelect }>;

type DashboardProductGroup = {
  productId: string;
  _sum: {
    quantity: number | null;
    lineRentalTotal: Prisma.Decimal | null;
  };
  _count: { _all: number };
};

type DashboardAssetGroup = {
  assetUnitId: string;
  _count: { _all: number };
};

type DashboardTrendRawRow = {
  bucketStart: string;
  orderCount: number | bigint;
  rentalRevenue: Prisma.Decimal | number | string | null;
  deliveryRevenue: Prisma.Decimal | number | string | null;
  collectedTotal: Prisma.Decimal | number | string | null;
  damageCompensationTotal: Prisma.Decimal | number | string | null;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOperationsOverview(dto: GetDashboardOperationsDto): Promise<DashboardOperationsOverviewOutDto> {
    this.validateDateRange(dto);

    const operationalWhere = this.buildOperationalOrderWhere(dto);
    // The regular dashboard scope excludes cancelled orders by default, but
    // cancellation/refund work must remain visible so the store can finish it.
    const allPeriodWhere = this.buildOperationalOrderWhere({ ...dto, includeCancelled: true });
    const attentionWhere = this.buildAttentionWhere(dto);
    const allocationWhere = this.buildAllocationWhere(dto);
    const totalAssetsWhere: Prisma.AssetUnitWhereInput = { deletedAt: null };
    const assignableAssetsWhere: Prisma.AssetUnitWhereInput = {
      deletedAt: null,
      isActive: true,
      status: AssetStatus.AVAILABLE,
    };

    // V1 intentionally reads order snapshots for one coherent dashboard view.
    // Cash-flow reporting by payment/refund transaction date belongs to reports.
    const aggregates = await this.prisma.$transaction(async (tx) => {
      const [
        totalOrders,
        cancelledOrders,
        attentionOrders,
        pickupDue,
        returnDue,
        overdueReturns,
        pendingPayments,
        refundDueOrders,
        pendingRefundTransactions,
        financialAggregate,
        pendingRefundAggregate,
        totalAssets,
        scheduledAssetGroups,
        freeAssets,
        unavailableAssets,
        maintenanceAssets,
        lostAssets,
        damagedAssets,
        topProductGroups,
        topAssetGroups,
        refundDueAggregate,
      ] = await Promise.all([
        tx.rentalOrder.count({ where: operationalWhere }),
        tx.rentalOrder.count({ where: { ...allPeriodWhere, status: OrderStatus.CANCELLED } }),
        tx.rentalOrder.count({ where: attentionWhere }),
        tx.rentalOrder.count({
          where: {
            ...operationalWhere,
            startDate: { gte: dto.fromDate, lt: dto.toDate },
            handoverStatus: { not: HandoverStatus.HANDED_OVER },
          },
        }),
        tx.rentalOrder.count({
          where: {
            ...operationalWhere,
            endDate: { gte: dto.fromDate, lt: dto.toDate },
            returnStatus: { not: ReturnStatus.INSPECTED },
          },
        }),
        tx.rentalOrder.count({
          where: {
            ...this.baseOrderWhere(dto.includeCancelled),
            status: OrderStatus.RENTING,
            actualReturnDate: null,
            endDate: { lt: new Date() },
          },
        }),
        tx.rentalOrder.count({
          where: {
            ...operationalWhere,
            OR: [
              { amountDueBeforeHandover: { gt: 0 } },
              {
                paymentTransactions: {
                  some: { direction: PaymentDirection.INBOUND, status: PaymentTransactionStatus.PENDING },
                },
              },
            ],
          },
        }),
        tx.rentalOrder.count({ where: { ...allPeriodWhere, refundDue: { gt: 0 } } }),
        tx.refund.count({
          where: {
            status: { in: [RentalRefundStatus.PENDING, RentalRefundStatus.PROCESSING] },
            order: allPeriodWhere,
          },
        }),
        tx.rentalOrder.aggregate({
          where: operationalWhere,
          _sum: {
            rentalFeeTotal: true,
            deliveryFeeTotal: true,
            paidTotal: true,
            securityDepositTotal: true,
            actualRefundTotal: true,
            amountDueBeforeHandover: true,
            refundDue: true,
            damageCompensationTotal: true,
          },
        }),
        tx.refund.aggregate({
          where: {
            status: { in: [RentalRefundStatus.PENDING, RentalRefundStatus.PROCESSING] },
            order: allPeriodWhere,
          },
          _sum: { amount: true },
        }),
        tx.assetUnit.count({ where: totalAssetsWhere }),
        tx.rentalAssetAllocation.groupBy({
          by: ['assetUnitId'],
          where: allocationWhere,
        }),
        tx.assetUnit.count({
          where: {
            ...assignableAssetsWhere,
            assetAllocations: { none: allocationWhere },
          },
        }),
        tx.assetUnit.count({
          where: {
            ...totalAssetsWhere,
            OR: [{ isActive: false }, { status: { not: AssetStatus.AVAILABLE } }],
          },
        }),
        tx.assetUnit.count({ where: { ...totalAssetsWhere, status: AssetStatus.MAINTENANCE } }),
        tx.assetUnit.count({ where: { ...totalAssetsWhere, status: AssetStatus.LOST } }),
        tx.assetUnit.count({ where: { ...totalAssetsWhere, condition: AssetCondition.DAMAGED } }),
        tx.rentalOrderLine.groupBy({
          by: ['productId'],
          where: { order: operationalWhere },
          _sum: { quantity: true, lineRentalTotal: true },
          _count: { _all: true },
        }),
        tx.rentalAssetAllocation.groupBy({
          by: ['assetUnitId'],
          where: {
            status: { in: [RentalAllocationStatus.HANDED_OVER, RentalAllocationStatus.RETURNED] },
            orderLine: { order: operationalWhere },
          },
          _count: { _all: true },
        }),
        tx.rentalOrder.aggregate({
          where: allPeriodWhere,
          _sum: { refundDue: true },
        }),
      ]);

      return {
        totalOrders,
        cancelledOrders,
        attentionOrders,
        pickupDue,
        returnDue,
        overdueReturns,
        pendingPayments,
        refundDueOrders,
        pendingRefundTransactions,
        financialAggregate,
        pendingRefundAggregate,
        totalAssets,
        scheduledAssetGroups,
        freeAssets,
        unavailableAssets,
        maintenanceAssets,
        lostAssets,
        damagedAssets,
        topProductGroups: topProductGroups as DashboardProductGroup[],
        topAssetGroups: topAssetGroups as DashboardAssetGroup[],
        refundDueAggregate,
      };
    });

    const [attentionPreviewRecords, scheduleRecords] = await Promise.all([
      this.prisma.rentalOrder.findMany({
        where: attentionWhere,
        orderBy: [{ endDate: 'asc' }, { startDate: 'asc' }, { id: 'asc' }],
        take: 20,
        select: attentionOrderSelect,
      }),
      this.prisma.rentalOrder.findMany({
        where: {
          ...operationalWhere,
          OR: [
            { startDate: { gte: dto.fromDate, lt: dto.toDate } },
            { endDate: { gte: dto.fromDate, lt: dto.toDate } },
          ],
        },
        orderBy: [{ startDate: 'asc' }, { endDate: 'asc' }, { id: 'asc' }],
        take: 50,
        select: scheduleOrderSelect,
      }),
    ]);

    const attentionPreview = attentionPreviewRecords
      .map((order) => this.toAttentionOut(order, dto))
      .filter((item): item is DashboardAttentionOutDto => item !== null)
      .sort((left, right) => this.attentionSortValue(left) - this.attentionSortValue(right))
      .slice(0, 8);

    const topProducts = await this.getTopProducts(aggregates.topProductGroups, operationalWhere);
    const topAssets = await this.getTopAssets(aggregates.topAssetGroups, operationalWhere);
    const schedulePreview = this.buildSchedulePreview(scheduleRecords, dto).slice(0, 10);
    const financialSum = aggregates.financialAggregate._sum;
    const securityDepositTotal = this.toNumber(financialSum.securityDepositTotal);
    const actualRefundTotal = this.toNumber(financialSum.actualRefundTotal);

    return {
      generatedAt: new Date(),
      period: {
        fromDate: dto.fromDate,
        toDate: dto.toDate,
        timezone: dto.timezone,
        dateBasis: DASHBOARD_DATE_BASIS,
      },
      summary: {
        totalOrders: aggregates.totalOrders,
        cancelledOrders: aggregates.cancelledOrders,
        attentionOrders: aggregates.attentionOrders,
        pickupDue: aggregates.pickupDue,
        returnDue: aggregates.returnDue,
        overdueReturns: aggregates.overdueReturns,
        pendingPayments: aggregates.pendingPayments,
        refundDueOrders: aggregates.refundDueOrders,
        pendingRefundTransactions: aggregates.pendingRefundTransactions,
      },
      financials: {
        rentalRevenue: this.toNumber(financialSum.rentalFeeTotal),
        deliveryRevenue: this.toNumber(financialSum.deliveryFeeTotal),
        collectedTotal: this.toNumber(financialSum.paidTotal),
        depositHeldTotal: Math.max(0, securityDepositTotal - actualRefundTotal),
        amountDueBeforeHandover: this.toNumber(financialSum.amountDueBeforeHandover),
        refundDueTotal: this.toNumber(aggregates.refundDueAggregate._sum.refundDue),
        pendingRefundTotal: this.toNumber(aggregates.pendingRefundAggregate._sum.amount),
        damageCompensationTotal: this.toNumber(financialSum.damageCompensationTotal),
        // TODO: Add AssetMaintenanceCost after the asset maintenance workflow exists.
        repairCostTotal: null,
      },
      availability: {
        totalAssets: aggregates.totalAssets,
        scheduledAssets: aggregates.scheduledAssetGroups.length,
        freeAssets: aggregates.freeAssets,
        unavailableAssets: aggregates.unavailableAssets,
        maintenanceAssets: aggregates.maintenanceAssets,
        lostAssets: aggregates.lostAssets,
        damagedAssets: aggregates.damagedAssets,
      },
      topProducts,
      topAssets,
      attentionPreview,
      schedulePreview,
    };
  }

  async getAttention(query: GetDashboardAttentionQueryDto) {
    this.validateDateRange(query);

    const where = this.buildAttentionWhere(query, query.type);
    const skip = (query.page - 1) * query.perPage;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.rentalOrder.findMany({
        where,
        skip,
        take: query.perPage,
        orderBy: [{ endDate: 'asc' }, { startDate: 'asc' }, { id: 'asc' }],
        select: attentionOrderSelect,
      }),
      this.prisma.rentalOrder.count({ where }),
    ]);

    return {
      items: items
        .map((order) => this.toAttentionOut(order, query))
        .filter((item): item is DashboardAttentionOutDto => item !== null)
        .sort((left, right) => this.attentionSortValue(left) - this.attentionSortValue(right)),
      total,
      page: query.page,
      perPage: query.perPage,
    };
  }

  async getTrends(dto: GetDashboardTrendsDto): Promise<DashboardTrendsOutDto> {
    this.validateDateRange(dto);

    const bucketUnit = this.getTrendBucketUnit(dto.groupBy);
    const cancelledClause = dto.includeCancelled ? Prisma.empty : Prisma.sql`AND "status" <> ${OrderStatus.CANCELLED}`;
    // The date bucket is computed in PostgreSQL so trends do not require loading
    // every order into Node. The query uses rental start date by design; a
    // transaction-date financial report needs a separate read model/query.
    const rows = await this.prisma.$queryRaw<DashboardTrendRawRow[]>(Prisma.sql`
      SELECT
        to_char(
          date_trunc(
            ${bucketUnit},
            "startDate" AT TIME ZONE 'UTC' AT TIME ZONE ${dto.timezone}
          ),
          'YYYY-MM-DD"T"HH24:MI:SS'
        ) AS "bucketStart",
        COUNT(*)::int AS "orderCount",
        COALESCE(SUM("rentalFeeTotal"), 0) AS "rentalRevenue",
        COALESCE(SUM("deliveryFeeTotal"), 0) AS "deliveryRevenue",
        COALESCE(SUM("paidTotal"), 0) AS "collectedTotal",
        COALESCE(SUM("damageCompensationTotal"), 0) AS "damageCompensationTotal"
      FROM "RentalOrder"
      WHERE "deletedAt" IS NULL
        AND "startDate" >= ${dto.fromDate}
        AND "startDate" < ${dto.toDate}
        ${cancelledClause}
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    const items: DashboardTrendItemOutDto[] = rows.map((row) => ({
      bucketStart: row.bucketStart,
      orderCount: Number(row.orderCount),
      rentalRevenue: this.toNumber(row.rentalRevenue),
      deliveryRevenue: this.toNumber(row.deliveryRevenue),
      collectedTotal: this.toNumber(row.collectedTotal),
      damageCompensationTotal: this.toNumber(row.damageCompensationTotal),
    }));

    return {
      period: {
        fromDate: dto.fromDate,
        toDate: dto.toDate,
        timezone: dto.timezone,
        dateBasis: DASHBOARD_DATE_BASIS,
      },
      groupBy: dto.groupBy,
      items,
    };
  }

  private buildOperationalOrderWhere(dto: DashboardDateRangeQuery): Prisma.RentalOrderWhereInput {
    return {
      ...this.baseOrderWhere(dto.includeCancelled),
      startDate: { lt: dto.toDate },
      endDate: { gt: dto.fromDate },
    };
  }

  private baseOrderWhere(includeCancelled: boolean): Prisma.RentalOrderWhereInput {
    return {
      deletedAt: null,
      ...(includeCancelled ? {} : { status: { not: OrderStatus.CANCELLED } }),
    };
  }

  private buildAllocationWhere(dto: DashboardDateRangeQuery): Prisma.RentalAssetAllocationWhereInput {
    return {
      status: { in: BLOCKING_ALLOCATION_STATUSES },
      startDate: { lt: dto.toDate },
      blockedEndDate: { gt: dto.fromDate },
      orderLine: {
        order: this.baseOrderWhere(dto.includeCancelled),
      },
    };
  }

  /**
   * An order may satisfy multiple operational rules, but the dashboard exposes
   * one primary action per order. The mapper below applies the same precedence
   * used by this query so the count and attention list stay explainable.
   */
  private buildAttentionWhere(
    dto: DashboardDateRangeQuery,
    type?: DashboardAttentionType,
  ): Prisma.RentalOrderWhereInput {
    // Cancelled orders do not need pickup/payment/return work. They are kept
    // out of those attention types even when includeCancelled=true; a cancelled
    // order is actionable here only when it still has refund work pending.
    const operational = this.buildOperationalOrderWhere({ ...dto, includeCancelled: false });
    const refundOperational = this.buildOperationalOrderWhere({ ...dto, includeCancelled: true });
    const conditions: Record<DashboardAttentionType, Prisma.RentalOrderWhereInput> = {
      [DashboardAttentionType.PAYMENT_CONFIRMATION]: {
        AND: [
          operational,
          {
            OR: [
              { amountDueBeforeHandover: { gt: 0 } },
              {
                paymentTransactions: {
                  some: { direction: PaymentDirection.INBOUND, status: PaymentTransactionStatus.PENDING },
                },
              },
            ],
          },
        ],
      },
      [DashboardAttentionType.PICKUP_DUE]: {
        AND: [operational, { startDate: { gte: dto.fromDate, lt: dto.toDate } }, { handoverStatus: { not: HandoverStatus.HANDED_OVER } }],
      },
      [DashboardAttentionType.RETURN_DUE]: {
        AND: [operational, { endDate: { gte: dto.fromDate, lt: dto.toDate } }, { returnStatus: { not: ReturnStatus.INSPECTED } }],
      },
      [DashboardAttentionType.OVERDUE_RETURN]: {
        ...this.baseOrderWhere(false),
        status: OrderStatus.RENTING,
        actualReturnDate: null,
        endDate: { lt: new Date() },
      },
      [DashboardAttentionType.REFUND_PENDING]: {
        AND: [
          refundOperational,
          {
            OR: [
              { refundDue: { gt: 0 } },
              {
                refunds: {
                  some: { status: { in: [RentalRefundStatus.PENDING, RentalRefundStatus.PROCESSING] } },
                },
              },
            ],
          },
        ],
      },
      [DashboardAttentionType.DISPUTE]: {
        AND: [operational, { status: OrderStatus.DISPUTED }],
      },
    };

    return { OR: type ? [conditions[type]] : Object.values(conditions) };
  }

  private async getTopProducts(groups: DashboardProductGroup[], operationalWhere: Prisma.RentalOrderWhereInput): Promise<DashboardTopProductOutDto[]> {
    const topGroups = [...groups]
      .sort((left, right) => {
        const quantityDifference = (right._sum.quantity ?? 0) - (left._sum.quantity ?? 0);
        if (quantityDifference !== 0) return quantityDifference;
        return this.toNumber(right._sum.lineRentalTotal) - this.toNumber(left._sum.lineRentalTotal);
      })
      .slice(0, 5);

    if (topGroups.length === 0) return [];

    const productIds = topGroups.map((group) => group.productId);
    const [products, lines] = await Promise.all([
      this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true } }),
      this.prisma.rentalOrderLine.findMany({
        where: { productId: { in: productIds }, order: operationalWhere },
        select: {
          productId: true,
          quantity: true,
          order: { select: { startDate: true, endDate: true } },
        },
      }),
    ]);

    const productById = new Map(products.map((product) => [product.id, product]));
    const rentalDeviceDays = new Map<string, number>();
    for (const line of lines) {
      const durationDays = Math.max(0, line.order.endDate.getTime() - line.order.startDate.getTime()) / 86_400_000;
      rentalDeviceDays.set(line.productId, (rentalDeviceDays.get(line.productId) ?? 0) + durationDays * line.quantity);
    }

    return topGroups.flatMap((group) => {
      const product = productById.get(group.productId);
      if (!product) return [];

      return [
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          rentedQuantity: group._sum.quantity ?? 0,
          rentalOrderCount: group._count._all,
          rentalDeviceDays: this.roundMoney(rentalDeviceDays.get(product.id) ?? 0),
          rentalRevenue: this.toNumber(group._sum.lineRentalTotal),
        },
      ];
    });
  }

  private async getTopAssets(groups: DashboardAssetGroup[], operationalWhere: Prisma.RentalOrderWhereInput): Promise<DashboardTopAssetOutDto[]> {
    const topGroups = [...groups].sort((left, right) => right._count._all - left._count._all).slice(0, 5);
    if (topGroups.length === 0) return [];

    const assetUnitIds = topGroups.map((group) => group.assetUnitId);
    const [assets, allocations] = await Promise.all([
      this.prisma.assetUnit.findMany({
        where: { id: { in: assetUnitIds }, deletedAt: null },
        select: {
          id: true,
          serialNumber: true,
          product: { select: { id: true, name: true } },
        },
      }),
      this.prisma.rentalAssetAllocation.findMany({
        where: {
          assetUnitId: { in: assetUnitIds },
          status: { in: [RentalAllocationStatus.HANDED_OVER, RentalAllocationStatus.RETURNED] },
          orderLine: { order: operationalWhere },
        },
        select: { assetUnitId: true, startDate: true, endDate: true },
      }),
    ]);

    const assetById = new Map(assets.map((asset) => [asset.id, asset]));
    const rentalDeviceDays = new Map<string, number>();
    for (const allocation of allocations) {
      const durationDays = Math.max(0, allocation.endDate.getTime() - allocation.startDate.getTime()) / 86_400_000;
      rentalDeviceDays.set(allocation.assetUnitId, (rentalDeviceDays.get(allocation.assetUnitId) ?? 0) + durationDays);
    }

    return topGroups.flatMap((group) => {
      const asset = assetById.get(group.assetUnitId);
      if (!asset) return [];

      return [
        {
          assetUnitId: asset.id,
          serialNumber: asset.serialNumber,
          productId: asset.product.id,
          productName: asset.product.name,
          rentalCount: group._count._all,
          rentalDeviceDays: this.roundMoney(rentalDeviceDays.get(asset.id) ?? 0),
        },
      ];
    });
  }

  private buildSchedulePreview(records: ScheduleOrderRecord[], dto: DashboardDateRangeQuery): DashboardScheduleItemOutDto[] {
    const events: DashboardScheduleItemOutDto[] = [];
    for (const order of records) {
      const productSummary = this.productSummary(order.lines);
      const customerName = this.getCustomerField(order.customerSnapshot, 'name') ?? 'Chưa có tên khách';

      if (order.startDate >= dto.fromDate && order.startDate < dto.toDate) {
        events.push({
          type: DashboardScheduleType.PICKUP,
          orderId: order.id,
          orderCode: order.code,
          orderStatus: order.status,
          customerName,
          productSummary,
          scheduledAt: order.startDate,
        });
      }

      if (order.endDate >= dto.fromDate && order.endDate < dto.toDate) {
        events.push({
          type: DashboardScheduleType.RETURN,
          orderId: order.id,
          orderCode: order.code,
          orderStatus: order.status,
          customerName,
          productSummary,
          scheduledAt: order.endDate,
        });
      }
    }

    return events.sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime());
  }

  private toAttentionOut(order: AttentionOrderRecord, dto: DashboardDateRangeQuery): DashboardAttentionOutDto | null {
    const now = new Date();
    const pendingPayment =
      this.toNumber(order.amountDueBeforeHandover) > 0 ||
      order.paymentTransactions.some((payment) => payment.status === PaymentTransactionStatus.PENDING);
    const pendingRefund =
      this.toNumber(order.refundDue) > 0 ||
      order.refunds.some((refund) => refund.status === RentalRefundStatus.PENDING || refund.status === RentalRefundStatus.PROCESSING);
    const overdue = order.status === OrderStatus.RENTING && !order.actualReturnDate && order.endDate.getTime() < now.getTime();
    const pickupDue = order.startDate >= dto.fromDate && order.startDate < dto.toDate && order.handoverStatus !== HandoverStatus.HANDED_OVER;
    const returnDue = order.endDate >= dto.fromDate && order.endDate < dto.toDate && order.returnStatus !== ReturnStatus.INSPECTED;

    let type: DashboardAttentionType | null = null;
    let priority = DashboardAttentionPriority.MEDIUM;
    let message = '';
    let amount: number | null = null;

    if (order.status === OrderStatus.DISPUTED) {
      type = DashboardAttentionType.DISPUTE;
      priority = DashboardAttentionPriority.HIGH;
      message = 'Đơn đang ở trạng thái tranh chấp';
    } else if (overdue) {
      type = DashboardAttentionType.OVERDUE_RETURN;
      priority = DashboardAttentionPriority.HIGH;
      const overdueHours = Math.max(1, Math.floor((now.getTime() - order.endDate.getTime()) / 3_600_000));
      message = `Đã quá hạn trả máy ${overdueHours} giờ`;
    } else if (pendingRefund) {
      type = DashboardAttentionType.REFUND_PENDING;
      priority = DashboardAttentionPriority.HIGH;
      amount = this.toNumber(order.refundDue);
      message = order.refunds.some((refund) => refund.status === RentalRefundStatus.PENDING || refund.status === RentalRefundStatus.PROCESSING)
        ? 'Có yêu cầu hoàn tiền đang chờ xử lý'
        : 'Đơn có khoản tiền cần hoàn';
    } else if (pendingPayment) {
      type = DashboardAttentionType.PAYMENT_CONFIRMATION;
      amount = this.toNumber(order.amountDueBeforeHandover);
      message = order.paymentTransactions.some((payment) => payment.status === PaymentTransactionStatus.PENDING)
        ? 'Có giao dịch thanh toán chờ xác nhận'
        : 'Còn phải thu trước khi bàn giao';
    } else if (pickupDue) {
      type = DashboardAttentionType.PICKUP_DUE;
      message = 'Sắp đến giờ nhận máy nhưng chưa bàn giao';
    } else if (returnDue) {
      type = DashboardAttentionType.RETURN_DUE;
      message = 'Có lịch trả máy cần tiếp nhận và kiểm tra';
    }

    if (!type) return null;

    return {
      type,
      priority,
      orderId: order.id,
      orderCode: order.code,
      orderStatus: order.status,
      handoverStatus: order.handoverStatus,
      returnStatus: order.returnStatus,
      settlementStatus: order.settlementStatus,
      customerName: this.getCustomerField(order.customerSnapshot, 'name') ?? 'Chưa có tên khách',
      customerPhone: this.getCustomerField(order.customerSnapshot, 'phone'),
      productSummary: this.productSummary(order.lines),
      startDate: order.startDate,
      endDate: order.endDate,
      amount,
      message,
    };
  }

  private attentionSortValue(item: DashboardAttentionOutDto): number {
    const priority = item.priority === DashboardAttentionPriority.HIGH ? 0 : item.priority === DashboardAttentionPriority.MEDIUM ? 1 : 2;
    const type = item.type === DashboardAttentionType.OVERDUE_RETURN ? 0 : item.type === DashboardAttentionType.DISPUTE ? 1 : 2;
    return priority * 10 + type;
  }

  private productSummary(lines: Array<{ quantity: number; product: { name: string } }>): string {
    if (lines.length === 0) return 'Chưa có sản phẩm';
    const visible = lines.slice(0, 2).map((line) => `${line.product.name} × ${line.quantity}`);
    return lines.length > 2 ? `${visible.join(' · ')} · +${lines.length - 2} sản phẩm` : visible.join(' · ');
  }

  private getCustomerField(snapshot: Prisma.JsonValue, field: 'name' | 'phone'): string | null {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
    const value = (snapshot as Record<string, unknown>)[field];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private getTrendBucketUnit(groupBy: DashboardTrendGroupBy): 'day' | 'week' | 'month' {
    if (groupBy === DashboardTrendGroupBy.WEEK) return 'week';
    if (groupBy === DashboardTrendGroupBy.MONTH) return 'month';
    return 'day';
  }

  private validateDateRange(dto: DashboardDateRangeQuery): void {
    if (!(dto.fromDate instanceof Date) || Number.isNaN(dto.fromDate.getTime()) || !(dto.toDate instanceof Date) || Number.isNaN(dto.toDate.getTime())) {
      throw new BadRequestException(DASHBOARD_DATE_RANGE_INVALID);
    }

    const duration = dto.toDate.getTime() - dto.fromDate.getTime();
    if (duration <= 0 || duration > MAX_DASHBOARD_RANGE_DAYS * 86_400_000) {
      throw new BadRequestException(DASHBOARD_DATE_RANGE_INVALID);
    }

    try {
      new Intl.DateTimeFormat('en-US', { timeZone: dto.timezone }).format(dto.fromDate);
    } catch {
      throw new BadRequestException(DASHBOARD_TIMEZONE_INVALID);
    }
  }

  private toNumber(value: Prisma.Decimal | number | string | bigint | null | undefined): number {
    if (value === null || value === undefined) return 0;
    return Number(value.toString());
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

