import {
  RENTAL_ORDER_CUSTOMER_INVALID,
  RENTAL_ORDER_ASSET_UNIT_INVALID,
  RENTAL_ORDER_NOT_FOUND,
  RENTAL_ORDER_PRODUCT_INVALID,
  RENTAL_ORDER_STATUS_TRANSITION_INVALID,
  RENTAL_ORDER_UNAVAILABLE,
} from '@/libs/constants/error.constants';
import { buildRentalOrderSearchText, normalizeSearchText } from '@/libs/utils/search-text.util';
import { Prisma } from '@generated/prisma/client';
import { CollateralType, CustomerStatus, OrderSource, OrderStatus, PaymentStatus, PickupMethod, RefundStatus, RentalOrderItemStatus } from '@generated/prisma/enums';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from '../products/products.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { RentalOrderAvailabilityOutDto } from './dto/check-rental-order-availability.dto';
import { CreateRentalOrderDto, RentalOrderItemInDto } from './dto/create-rental-order.dto';
import { DeleteRentalOrdersDto } from './dto/delete-rental-orders.dto';
import { GetAllRentalOrdersDto } from './dto/get-all-rental-orders.dto';
import { RentalOrderListItemOutDto, RentalOrderOutDto } from './dto/rental-order-out.dto';
import { UpdateRentalOrderDto } from './dto/update-rental-order.dto';
import { NormalizedRentalOrderItem, RentalOrderAvailabilityService } from './services/rental-order-availability.service';
import { RentalOrderEventsService } from './services/rental-order-events.service';
import { RentalOrderLogAction, RentalOrderLogChange, RentalOrderLogsService } from './services/rental-order-logs.service';
import { RentalOrderPricingService } from './services/rental-order-pricing.service';

const SOFT_DELETABLE_STATUSES = [OrderStatus.CREATED, OrderStatus.CANCELLED];

const rentalOrderInclude = {
  customer: true,
  items: {
    orderBy: {
      createdAt: 'asc',
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
      assetUnit: {
        select: {
          id: true,
          serialNumber: true,
        },
      },
    },
  },
  payments: {
    where: {
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  statusHistories: {
    orderBy: {
      createdAt: 'asc',
    },
  },
  logs: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
  },
} as const satisfies Prisma.RentalOrderInclude;

const rentalOrderListSelect = {
  id: true,
  code: true,
  source: true,
  status: true,
  paymentStatus: true,
  refundStatus: true,
  customerSnapshot: true,
  startDate: true,
  endDate: true,
  deliveryFeeTotal: true,
  rentalFeeTotal: true,
  depositTotal: true,
  bookingHoldTotal: true,
  lateFeeTotal: true,
  damageFeeTotal: true,
  discountTotal: true,
  compensationFeeTotal: true,
  chargeTotal: true,
  paidTotal: true,
  estimatedRefundTotal: true,
  actualRefundTotal: true,
  handoverRequiredTotal: true,
  handoverAmountDue: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.RentalOrderSelect;

type RentalOrderWithRelations = Prisma.RentalOrderGetPayload<{ include: typeof rentalOrderInclude }>;
type RentalOrderListItemWithRelations = Prisma.RentalOrderGetPayload<{ select: typeof rentalOrderListSelect }>;
type RentalProduct = Awaited<ReturnType<ProductsService['getActiveProductsForRental']>>[number];
type RentalOrderFinancialBreakdownInput = Pick<
  RentalOrderWithRelations,
  | 'rentalFeeTotal'
  | 'deliveryFeeTotal'
  | 'discountTotal'
  | 'lateFeeTotal'
  | 'damageFeeTotal'
  | 'compensationFeeTotal'
  | 'chargeTotal'
  | 'paidTotal'
  | 'actualRefundTotal'
>;

export type RentalOrderSettlementStatus = 'NEED_COLLECT' | 'NEED_REFUND' | 'SETTLED';

@Injectable()
export class RentalOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly availabilityService: RentalOrderAvailabilityService,
    private readonly pricingService: RentalOrderPricingService,
    private readonly eventsService: RentalOrderEventsService,
    private readonly logsService: RentalOrderLogsService,
  ) {}

  async getAllRentalOrders(query: GetAllRentalOrdersDto) {
    const { search, customerId, status, paymentStatus, refundStatus, source, pickupMethod, fromDate, toDate, page, perPage, sort, sortBy } = query;
    const skip = (page - 1) * perPage;
    const searchText = normalizeSearchText(search);

    const where: Prisma.RentalOrderWhereInput = {
      deletedAt: null,
      ...(customerId && { customerId }),
      ...(status && { status }),
      ...(paymentStatus && { paymentStatus }),
      ...(refundStatus && { refundStatus }),
      ...(source && { source }),
      ...(pickupMethod && { pickupMethod }),
      ...(searchText && {
        searchText: {
          contains: searchText,
        },
      }),
      ...(fromDate &&
        toDate && {
          startDate: {
            lt: toDate,
          },
          endDate: {
            gt: fromDate,
          },
        }),
      ...(fromDate &&
        !toDate && {
          endDate: {
            gt: fromDate,
          },
        }),
      ...(!fromDate &&
        toDate && {
          startDate: {
            lt: toDate,
          },
        }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.rentalOrder.findMany({
        where,
        skip,
        take: perPage,
        orderBy: [{ [sortBy]: sort }, { id: 'asc' }],
        select: this.rentalOrderListSelect(),
      }),
      this.prisma.rentalOrder.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toRentalOrderListItemOut(item)),
      total,
      page,
      perPage,
    };
  }

  async getRentalOrderById(id: string): Promise<RentalOrderOutDto> {
    const order = await this.findExistingRentalOrderById(id);

    return this.toRentalOrderOut(order);
  }

  async createRentalOrder(dto: CreateRentalOrderDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    const systemSettings = await this.systemSettingsService.getDefaultSettingsForOrder();
    const normalizedItems = this.normalizeItems(dto.items);
    const availability = await this.availabilityService.evaluateAvailability({
      startDate: dto.startDate,
      endDate: dto.endDate,
      items: normalizedItems,
      systemSettings,
    });

    this.assertAvailable(availability);

    const [customer, products, assetUnits] = await Promise.all([
      this.findCustomerForRental(dto.customerId),
      this.findProductsForItems(normalizedItems),
      this.findAssetUnitsForItems(normalizedItems),
    ]);
    const pricedItems = this.pricingService.priceItems(
      normalizedItems,
      products,
      assetUnits,
      systemSettings,
      dto.startDate,
      dto.endDate,
      availability.blockedEndDate,
    );
    const totals = this.pricingService.calculateTotals(pricedItems, dto.deliveryFeeTotal ?? 0, dto.discountTotal ?? 0);

    const order = await this.prisma.$transaction(async (tx) => {
      const code = await this.generateOrderCode(tx);

      const order = await tx.rentalOrder.create({
        data: {
          code,
          source: OrderSource.ADMIN,
          status: OrderStatus.CREATED,
          paymentStatus: PaymentStatus.UNPAID,
          refundStatus: RefundStatus.NOT_REQUIRED,
          settingsSnapshot: this.buildSettingsSnapshot(systemSettings),
          customerId: customer.id,
          customerSnapshot: this.buildCustomerSnapshot(customer),
          startDate: dto.startDate,
          endDate: dto.endDate,
          pickupMethod: dto.pickupMethod ?? PickupMethod.PICKUP_AT_STORE,
          deliveryAddress: dto.deliveryAddress,
          deliveryFeeTotal: totals.deliveryFeeTotal,
          rentalFeeTotal: totals.rentalFeeTotal,
          depositTotal: totals.depositTotal,
          bookingHoldTotal: totals.bookingHoldTotal,
          lateFeeTotal: totals.lateFeeTotal,
          damageFeeTotal: totals.damageFeeTotal,
          compensationFeeTotal: totals.compensationFeeTotal,
          chargeTotal: totals.chargeTotal,
          discountTotal: totals.discountTotal,
          paidTotal: 0,
          estimatedRefundTotal: totals.estimatedRefundTotal,
          actualRefundTotal: totals.actualRefundTotal,
          adjustedDepositTotal: totals.adjustedDepositTotal,
          handoverRequiredTotal: totals.handoverRequiredTotal,
          handoverAmountDue: totals.handoverAmountDue,
          note: dto.note,
          internalNote: dto.internalNote,
          createdBy: currentUser.id,
          searchText: this.buildOrderSearchText({
            code,
            customer,
            deliveryAddress: dto.deliveryAddress,
            note: dto.note,
            internalNote: dto.internalNote,
          }),
          items: {
            create: this.pricingService.toCreateOrderItemsData(pricedItems),
          },
        },
        include: this.rentalOrderInclude(),
      });

      await this.eventsService.appendStatusChange(tx, {
        orderId: order.id,
        fromStatus: null,
        toStatus: OrderStatus.CREATED,
        createdBy: currentUser.id,
        note: 'Order created',
      });

      await this.logsService.appendLog(tx, {
        orderId: order.id,
        actor: currentUser,
        action: RentalOrderLogAction.CreateOrder,
        changes: [
          { field: 'code', label: 'Mã đơn', oldValue: null, newValue: code },
          { field: 'status', label: 'Trang thái', oldValue: null, newValue: OrderStatus.CREATED },
          { field: 'customerId', label: 'Khách hàng', oldValue: null, newValue: customer.id },
          { field: 'rentalPeriod.startDate', label: 'Giờ nhận', oldValue: null, newValue: dto.startDate },
          { field: 'rentalPeriod.endDate', label: 'Giờ trả', oldValue: null, newValue: dto.endDate },
          { field: 'financials.rentalFeeTotal', label: 'Tiền thuê', oldValue: null, newValue: totals.rentalFeeTotal },
          { field: 'financials.depositTotal', label: 'Cọc theo thiết bị', oldValue: null, newValue: totals.depositTotal },
          { field: 'items', label: 'Thiết bị', oldValue: null, newValue: pricedItems.map((item) => item.assetUnitId) },
        ],
        note: dto.note,
      });

      return tx.rentalOrder.findFirstOrThrow({
        where: { id: order.id },
        include: this.rentalOrderInclude(),
      });
    });

    return this.toRentalOrderOut(order);
  }

  async updateRentalOrder(id: string, dto: UpdateRentalOrderDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    const existingOrder = await this.findExistingRentalOrderById(id);
    this.assertStatusIn(existingOrder.status, [OrderStatus.CREATED, OrderStatus.CONFIRMED]);

    const startDate = dto.startDate ?? existingOrder.startDate;
    const endDate = dto.endDate ?? existingOrder.endDate;
    const shouldReprice = Boolean(dto.startDate || dto.endDate || dto.items);
    const normalizedItems = dto.items
      ? this.normalizeItems(dto.items).map((item) => {
          const existingItem = existingOrder.items.find(
            (orderItem) =>
              orderItem.productId === item.productId &&
              orderItem.assetUnitId === item.assetUnitId &&
              orderItem.deletedAt === null &&
              orderItem.status !== RentalOrderItemStatus.CANCELLED,
          );

          return {
            ...item,
            id: existingItem?.id,
          };
        })
      : this.normalizeExistingItems(existingOrder.items.filter((item) => item.deletedAt === null && item.status !== RentalOrderItemStatus.CANCELLED));
    const systemSettings = await this.systemSettingsService.getDefaultSettingsForOrder();
    const availability = shouldReprice
      ? await this.availabilityService.evaluateAvailability({
          startDate,
          endDate,
          items: normalizedItems,
          excludeOrderId: id,
          systemSettings,
        })
      : null;

    if (availability) {
      this.assertAvailable(availability);
    }

    const customer = existingOrder.customer;
    const pricedItems = shouldReprice
      ? this.pricingService.priceItems(
          normalizedItems,
          ...(await Promise.all([this.findProductsForItems(normalizedItems), this.findAssetUnitsForItems(normalizedItems)])),
          systemSettings,
          startDate,
          endDate,
          availability!.blockedEndDate,
        )
      : [];
    const deliveryAddress = this.hasOwn(dto, 'deliveryAddress') ? (dto.deliveryAddress ?? null) : existingOrder.deliveryAddress;
    const note = this.hasOwn(dto, 'note') ? (dto.note ?? null) : existingOrder.note;
    const internalNote = this.hasOwn(dto, 'internalNote') ? (dto.internalNote ?? null) : existingOrder.internalNote;
    const deliveryFeeTotal = dto.deliveryFeeTotal ?? Number(existingOrder.deliveryFeeTotal);
    const discountTotal = dto.discountTotal ?? Number(existingOrder.discountTotal);
    const nonRepricedChargeTotal = Math.max(
      Number(existingOrder.rentalFeeTotal) +
        Number(existingOrder.lateFeeTotal) +
        Number(existingOrder.damageFeeTotal) +
        Number(existingOrder.compensationFeeTotal) +
        deliveryFeeTotal -
        discountTotal,
      0,
    );
    const nonRepricedOriginalDepositTotal = existingOrder.items
      .filter((item) => item.deletedAt === null && item.status !== RentalOrderItemStatus.CANCELLED)
      .reduce((total, item) => total + Number(item.depositAmount), 0);
    const nonRepricedDepositTotal = this.pricingService.calculateProtectedDepositTotal(nonRepricedOriginalDepositTotal, nonRepricedChargeTotal);
    const nonRepricedHandoverTotals = this.pricingService.calculateHandoverTotals(
      nonRepricedDepositTotal,
      nonRepricedChargeTotal,
      existingOrder.collateralType,
    );
    const totals = shouldReprice
      ? this.pricingService.calculateTotals(pricedItems, deliveryFeeTotal, discountTotal)
      : {
          deliveryFeeTotal,
          rentalFeeTotal: Number(existingOrder.rentalFeeTotal),
          depositTotal: nonRepricedDepositTotal,
          bookingHoldTotal: Number(existingOrder.bookingHoldTotal),
          lateFeeTotal: Number(existingOrder.lateFeeTotal),
          damageFeeTotal: Number(existingOrder.damageFeeTotal),
          compensationFeeTotal: Number(existingOrder.compensationFeeTotal),
          chargeTotal: nonRepricedChargeTotal,
          discountTotal,
          adjustedDepositTotal: nonRepricedHandoverTotals.adjustedDepositTotal,
          handoverRequiredTotal: nonRepricedHandoverTotals.handoverRequiredTotal,
          handoverAmountDue: Math.max(nonRepricedHandoverTotals.handoverRequiredTotal - Number(existingOrder.paidTotal), 0),
          estimatedRefundTotal: Math.max(nonRepricedHandoverTotals.handoverRequiredTotal - nonRepricedChargeTotal, 0),
          actualRefundTotal: Number(existingOrder.actualRefundTotal),
        };
    const customerSnapshot = this.mergeJsonObject(existingOrder.customerSnapshot, dto.customerSnapshot);

    const order = await this.prisma.$transaction(async (tx) => {
      if (shouldReprice && dto.items && existingOrder.status === OrderStatus.CREATED) {
        await tx.rentalOrderItem.deleteMany({
          where: {
            orderId: id,
          },
        });

        await tx.rentalOrderItem.createMany({
          data: this.pricingService.toCreateManyOrderItemsData(id, pricedItems),
        });
      } else if (shouldReprice && dto.items && existingOrder.status === OrderStatus.CONFIRMED) {
        const nextActiveItemIds = new Set(pricedItems.filter((item) => item.id).map((item) => item.id!));

        await tx.rentalOrderItem.updateMany({
          where: {
            orderId: id,
            deletedAt: null,
            status: {
              in: [RentalOrderItemStatus.PENDING, RentalOrderItemStatus.ACTIVE],
            },
            id: {
              notIn: [...nextActiveItemIds],
            },
          },
          data: {
            status: RentalOrderItemStatus.CANCELLED,
            updatedBy: currentUser.id,
          },
        });

        for (const item of pricedItems) {
          if (item.id) {
            await tx.rentalOrderItem.update({
              where: {
                id: item.id,
              },
              data: {
                ...this.pricingService.toUpdateOrderItemData(item),
                status: RentalOrderItemStatus.ACTIVE,
                updatedBy: currentUser.id,
              },
            });
          } else {
            await tx.rentalOrderItem.create({
              data: {
                ...this.pricingService.toCreateManyOrderItemsData(id, [item])[0],
                status: RentalOrderItemStatus.ACTIVE,
                createdBy: currentUser.id,
              },
            });
          }
        }
      } else if (shouldReprice) {
        for (const item of pricedItems) {
          if (!item.id) continue;

          await tx.rentalOrderItem.update({
            where: { id: item.id },
            data: this.pricingService.toUpdateOrderItemData(item),
          });
        }
      }

      const updatedOrder = await tx.rentalOrder.update({
        where: { id },
        data: {
          customerSnapshot,
          startDate,
          endDate,
          settingsSnapshot: this.buildSettingsSnapshot(systemSettings),
          pickupMethod: dto.pickupMethod,
          deliveryAddress,
          deliveryFeeTotal: totals.deliveryFeeTotal,
          rentalFeeTotal: totals.rentalFeeTotal,
          depositTotal: totals.depositTotal,
          bookingHoldTotal: totals.bookingHoldTotal,
          lateFeeTotal: totals.lateFeeTotal,
          damageFeeTotal: totals.damageFeeTotal,
          compensationFeeTotal: totals.compensationFeeTotal,
          chargeTotal: totals.chargeTotal,
          discountTotal: totals.discountTotal,
          estimatedRefundTotal: totals.estimatedRefundTotal,
          actualRefundTotal: totals.actualRefundTotal,
          adjustedDepositTotal: totals.adjustedDepositTotal,
          handoverRequiredTotal: totals.handoverRequiredTotal,
          handoverAmountDue: Math.max(totals.handoverRequiredTotal - Number(existingOrder.paidTotal), 0),
          note,
          internalNote,
          updatedBy: currentUser.id,
          searchText: this.buildOrderSearchText({
            code: existingOrder.code,
            customer: this.getCustomerForSearch(customerSnapshot, customer),
            deliveryAddress,
            note,
            internalNote,
            cancelReason: existingOrder.cancelReason,
          }),
        },
        include: this.rentalOrderInclude(),
      });

      await this.logsService.appendLog(tx, {
        orderId: id,
        actor: currentUser,
        action: RentalOrderLogAction.UpdateOrder,
        changes: this.buildUpdateOrderChanges(existingOrder, updatedOrder),
        note: dto.note ?? dto.internalNote,
        skipIfNoChanges: true,
      });

      return tx.rentalOrder.findFirstOrThrow({
        where: { id },
        include: this.rentalOrderInclude(),
      });
    });

    return this.toRentalOrderOut(order);
  }

  async deleteRentalOrders(dto: DeleteRentalOrdersDto, currentUser: AuthUser): Promise<{ success: true }> {
    const uniqueIds = [...new Set(dto.rentalOrderIds)];
    if (uniqueIds.length === 0) {
      return { success: true };
    }

    const orders = await this.prisma.rentalOrder.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, code: true, status: true, deletedAt: true },
    });

    for (const order of orders) {
      this.assertStatusIn(order.status, SOFT_DELETABLE_STATUSES);
    }

    await this.prisma.$transaction(async (tx) => {
      const deletedAt = new Date();

      await tx.rentalOrderItem.updateMany({
        where: {
          orderId: { in: uniqueIds },
          deletedAt: null,
        },
        data: {
          status: RentalOrderItemStatus.CANCELLED,
          deletedAt,
          deletedBy: currentUser.id,
        },
      });

      await tx.rentalOrder.updateMany({
        where: { id: { in: uniqueIds } },
        data: {
          deletedAt,
          deletedBy: currentUser.id,
        },
      });

      for (const order of orders) {
        await this.logsService.appendLog(tx, {
          orderId: order.id,
          actor: currentUser,
          action: RentalOrderLogAction.DeleteOrder,
          changes: [
            { field: 'deletedAt', label: 'Xóa mềm', oldValue: order.deletedAt, newValue: deletedAt },
            { field: 'status', label: 'Trạng thái', oldValue: order.status, newValue: order.status },
          ],
          note: `Xoa don ${order.code}`,
        });
      }
    });

    return { success: true };
  }

  async transitionOrderStatusInTransaction(
    tx: Prisma.TransactionClient,
    params: {
      order: RentalOrderWithRelations;
      nextStatus: OrderStatus;
      currentUserId: string;
      note?: string | null;
    },
  ): Promise<RentalOrderWithRelations> {
    await this.eventsService.appendStatusChange(tx, {
      orderId: params.order.id,
      fromStatus: params.order.status,
      toStatus: params.nextStatus,
      createdBy: params.currentUserId,
      note: params.note,
    });

    return tx.rentalOrder.update({
      where: {
        id: params.order.id,
      },
      data: {
        status: params.nextStatus,
      },
      include: this.rentalOrderInclude(),
    });
  }

  async acquireAdvisoryLocks(tx: Prisma.TransactionClient, keys: string[]): Promise<void> {
    for (const key of [...new Set(keys)].sort()) {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
    }
  }

  private normalizeItems(items: RentalOrderItemInDto[]): NormalizedRentalOrderItem[] {
    return items.map((item) => ({
      productId: item.productId,
      assetUnitId: item.assetUnitId,
      note: item.note,
    }));
  }

  normalizeExistingItems(items: RentalOrderWithRelations['items']): NormalizedRentalOrderItem[] {
    return items.map((item) => ({
      id: item.id,
      productId: item.productId,
      assetUnitId: item.assetUnitId,
      note: item.note,
    }));
  }

  assertAvailable(availability: RentalOrderAvailabilityOutDto): void {
    if (!availability.isAvailable) {
      throw new BadRequestException({
        ...RENTAL_ORDER_UNAVAILABLE,
        error: availability.unavailableItems,
      });
    }
  }

  assertStatusIn(status: OrderStatus, allowedStatuses: OrderStatus[]): void {
    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException(RENTAL_ORDER_STATUS_TRANSITION_INVALID);
    }
  }

  private async findCustomerForRental(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        deletedAt: null,
        status: {
          not: CustomerStatus.BLOCKED,
        },
      },
    });

    if (!customer) {
      throw new BadRequestException(RENTAL_ORDER_CUSTOMER_INVALID);
    }

    return customer;
  }

  private async findProductsForItems(items: NormalizedRentalOrderItem[]): Promise<RentalProduct[]> {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await this.productsService.getActiveProductsForRental(productIds);

    if (products.length !== productIds.length) {
      throw new BadRequestException(RENTAL_ORDER_PRODUCT_INVALID);
    }

    return products;
  }

  private async findAssetUnitsForItems(items: NormalizedRentalOrderItem[]) {
    const assetUnitIds = [...new Set(items.map((item) => item.assetUnitId))];

    if (assetUnitIds.length === 0) {
      return [];
    }

    const assetUnits = await this.prisma.assetUnit.findMany({
      where: {
        id: {
          in: assetUnitIds,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        serialNumber: true,
      },
    });

    if (assetUnits.length !== assetUnitIds.length) {
      throw new BadRequestException(RENTAL_ORDER_ASSET_UNIT_INVALID);
    }

    return assetUnits;
  }

  async findExistingRentalOrderById(id: string): Promise<RentalOrderWithRelations> {
    const order = await this.findRentalOrderById(id);

    if (!order) {
      throw new NotFoundException(RENTAL_ORDER_NOT_FOUND);
    }

    return order;
  }

  async findExistingRentalOrderByIdInTransaction(tx: Prisma.TransactionClient, id: string): Promise<RentalOrderWithRelations> {
    const order = await tx.rentalOrder.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: this.rentalOrderInclude(),
    });

    if (!order) {
      throw new NotFoundException(RENTAL_ORDER_NOT_FOUND);
    }

    return order;
  }

  async findRentalOrderById(id: string) {
    return this.prisma.rentalOrder.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: this.rentalOrderInclude(),
    });
  }

  rentalOrderInclude() {
    return rentalOrderInclude;
  }

  rentalOrderListSelect() {
    return rentalOrderListSelect;
  }

  private async generateOrderCode(tx: Prisma.TransactionClient): Promise<string> {
    const latestOrder = await tx.rentalOrder.findFirst({
      where: {
        code: {
          startsWith: 'ORD-',
        },
      },
      orderBy: {
        code: 'desc',
      },
      select: {
        code: true,
      },
    });
    const latestNumber = latestOrder?.code ? Number(latestOrder.code.replace('ORD-', '')) || 0 : 0;

    return `ORD-${String(latestNumber + 1).padStart(6, '0')}`;
  }

  buildOrderSearchText(input: {
    code: string;
    customer: {
      name: string;
      phone?: string | null;
      email?: string | null;
      identityNumber?: string | null;
    };
    deliveryAddress?: string | null;
    note?: string | null;
    internalNote?: string | null;
    cancelReason?: string | null;
  }): string {
    return buildRentalOrderSearchText({
      code: input.code,
      customerName: input.customer.name,
      customerPhone: input.customer.phone,
      customerEmail: input.customer.email,
      customerIdentityNumber: input.customer.identityNumber,
      deliveryAddress: input.deliveryAddress,
      note: input.note,
      internalNote: input.internalNote,
      cancelReason: input.cancelReason,
    });
  }

  private buildSettingsSnapshot(systemSettings: Awaited<ReturnType<SystemSettingsService['getDefaultSettingsForOrder']>>): Prisma.InputJsonObject {
    return {
      id: systemSettings.id,
      bookingHoldPricePerUnit: Number(systemSettings.bookingHoldPricePerUnit),
      bookingBufferTimeMinutes: systemSettings.bookingBufferTimeMinutes,
      maxRentalTimeDays: systemSettings.maxRentalTimeDays,
      maxLateReturnTimeHours: systemSettings.maxLateReturnTimeHours,
    };
  }

  private buildCustomerSnapshot(customer: {
    id: string;
    code?: string | null;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    identityNumber?: string | null;
    socialContact?: string | null;
  }): Prisma.InputJsonObject {
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone ?? null,
      email: customer.email ?? null,
      address: customer.address ?? null,
      identityNumber: customer.identityNumber ?? null,
      socialContact: customer.socialContact ?? null,
    };
  }

  private mergeJsonObject(base: unknown, patch?: object): Prisma.InputJsonObject {
    const baseObject = this.isRecord(base) ? base : {};

    return {
      ...baseObject,
      ...(patch ?? {}),
    } as Prisma.InputJsonObject;
  }

  private getCustomerForSearch(
    snapshot: Prisma.InputJsonObject,
    fallback: {
      name: string;
      phone?: string | null;
      email?: string | null;
      identityNumber?: string | null;
    },
  ) {
    return {
      name: typeof snapshot.name === 'string' ? snapshot.name : fallback.name,
      phone: typeof snapshot.phone === 'string' ? snapshot.phone : fallback.phone,
      email: typeof snapshot.email === 'string' ? snapshot.email : fallback.email,
      identityNumber: typeof snapshot.identityNumber === 'string' ? snapshot.identityNumber : fallback.identityNumber,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private normalizeMoneyValue(value: unknown): unknown {
    if (typeof value !== 'string') return value;

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }

  private normalizeSettingsSnapshot(snapshot: unknown): unknown {
    if (!this.isRecord(snapshot)) return snapshot;

    return {
      ...snapshot,
      bookingHoldPricePerUnit: this.normalizeMoneyValue(snapshot.bookingHoldPricePerUnit),
    };
  }

  private normalizeItemSnapshot(snapshot: unknown): unknown {
    if (!this.isRecord(snapshot)) return snapshot;

    const product = this.isRecord(snapshot.product)
      ? {
          ...snapshot.product,
          dailyPrice: this.normalizeMoneyValue(snapshot.product.dailyPrice),
          halfDayPrice: this.normalizeMoneyValue(snapshot.product.halfDayPrice),
          hourlyOveragePrice: this.normalizeMoneyValue(snapshot.product.hourlyOveragePrice),
          depositAmount: this.normalizeMoneyValue(snapshot.product.depositAmount),
          rentalPriceTiers: Array.isArray(snapshot.product.rentalPriceTiers)
            ? snapshot.product.rentalPriceTiers.map((tier) =>
                this.isRecord(tier)
                  ? {
                      ...tier,
                      dailyPrice: this.normalizeMoneyValue(tier.dailyPrice),
                    }
                  : tier,
              )
            : [],
        }
      : snapshot.product;

    const pricing = this.isRecord(snapshot.pricing)
      ? {
          ...snapshot.pricing,
          durationHours: this.normalizeMoneyValue(snapshot.pricing.durationHours),
          billableDays: this.normalizeMoneyValue(snapshot.pricing.billableDays),
          billableHalfDays: this.normalizeMoneyValue(snapshot.pricing.billableHalfDays),
          overageHours: this.normalizeMoneyValue(snapshot.pricing.overageHours),
          unitPrice: this.normalizeMoneyValue(snapshot.pricing.unitPrice),
          depositAmount: this.normalizeMoneyValue(snapshot.pricing.depositAmount),
          bookingHoldAmount: this.normalizeMoneyValue(snapshot.pricing.bookingHoldAmount),
          lineTotal: this.normalizeMoneyValue(snapshot.pricing.lineTotal),
          appliedTier: this.isRecord(snapshot.pricing.appliedTier)
            ? {
                ...snapshot.pricing.appliedTier,
                dailyPrice: this.normalizeMoneyValue(snapshot.pricing.appliedTier.dailyPrice),
              }
            : snapshot.pricing.appliedTier,
        }
      : snapshot.pricing;

    return {
      ...snapshot,
      product,
      pricing,
    };
  }

  toRentalOrderOut(order: RentalOrderWithRelations): RentalOrderOutDto {
    const financialBreakdown = this.calculateFinancialBreakdown(order);

    return {
      id: order.id,
      code: order.code,
      source: order.source,
      status: order.status,
      paymentStatus: order.paymentStatus,
      refundStatus: order.refundStatus,
      customerId: order.customerId,
      customerSnapshot: order.customerSnapshot,
      settingsSnapshot: this.normalizeSettingsSnapshot(order.settingsSnapshot),
      rentalPeriod: {
        startDate: order.startDate,
        endDate: order.endDate,
        actualPickupDate: order.actualPickupDate,
        actualReturnDate: order.actualReturnDate,
      },
      fulfillment: {
        pickupMethod: order.pickupMethod,
        deliveryAddress: order.deliveryAddress,
        collateralDescription: order.collateralDescription,
        collateralType: order.collateralType ?? CollateralType.NONE,
      },
      financials: {
        deliveryFeeTotal: Number(order.deliveryFeeTotal),
        rentalFeeTotal: Number(order.rentalFeeTotal),
        depositTotal: Number(order.depositTotal),
        bookingHoldTotal: Number(order.bookingHoldTotal),
        lateFeeTotal: Number(order.lateFeeTotal),
        damageFeeTotal: Number(order.damageFeeTotal),
        discountTotal: Number(order.discountTotal),
        compensationFeeTotal: Number(order.compensationFeeTotal),
        chargeTotal: Number(order.chargeTotal),
        paidTotal: Number(order.paidTotal),
        estimatedRefundTotal: Number(order.estimatedRefundTotal),
        actualRefundTotal: Number(order.actualRefundTotal),
        adjustedDepositTotal: Number(order.adjustedDepositTotal),
        handoverRequiredTotal: Number(order.handoverRequiredTotal),
        handoverAmountDue: Number(order.handoverAmountDue),
        ...financialBreakdown,
      },
      notes: {
        customerNote: order.note,
        internalNote: order.internalNote,
        cancelReason: order.cancelReason,
      },
      createdBy: order.createdBy,
      items: order.items.map((item) => this.toRentalOrderItemOut(item)),
      payments: order.payments.map((payment) => ({
        id: payment.id,
        kind: payment.kind,
        method: payment.method,
        status: payment.status,
        amount: Number(payment.amount),
        referenceCode: payment.referenceCode,
        note: payment.note,
        createdAt: payment.createdAt,
      })),
      statusHistories: order.statusHistories.map((history) => ({
        id: history.id,
        fromStatus: history.fromStatus,
        toStatus: history.toStatus,
        note: history.note,
        createdAt: history.createdAt,
      })),
      logs: order.logs.map((log) => this.toRentalOrderLogOut(log)),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      deletedAt: order.deletedAt,
    };
  }

  private toRentalOrderLogOut(log: RentalOrderWithRelations['logs'][number]) {
    return {
      id: log.id,
      orderId: log.orderId,
      actorId: log.actorId,
      action: log.action,
      entity: log.entity,
      changes: Array.isArray(log.changes) ? (log.changes as RentalOrderLogChange[]) : [],
      actorSnapshot: log.actorSnapshot,
      note: log.note,
      createdAt: log.createdAt,
    };
  }

  private toRentalOrderItemOut(item: RentalOrderWithRelations['items'][number]) {
    const snapshot = this.normalizeItemSnapshot(item.snapshot);
    const productSnapshot = this.isRecord(snapshot) && this.isRecord(snapshot.product)
      ? snapshot.product
      : {
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          rentalPriceTiers: [],
        };
    const assetUnitSnapshot = this.isRecord(snapshot) && this.isRecord(snapshot.assetUnit)
      ? snapshot.assetUnit
      : {
          id: item.assetUnit.id,
          serialNumber: item.assetUnit.serialNumber,
        };
    const pricingSnapshot = this.isRecord(snapshot) && this.isRecord(snapshot.pricing) ? snapshot.pricing : {};

    return {
      id: item.id,
      productId: item.productId,
      assetUnitId: item.assetUnitId,
      status: item.status,
      productSnapshot,
      assetUnitSnapshot,
      rentalPeriod: {
        startDate: item.startDate,
        endDate: item.endDate,
        blockedEndDate: item.blockedEndDate,
      },
      pricing: {
        pricingMode: typeof pricingSnapshot.pricingMode === 'string' ? pricingSnapshot.pricingMode : 'UNKNOWN',
        pricingLabel: typeof pricingSnapshot.pricingLabel === 'string' ? pricingSnapshot.pricingLabel : 'Gia thue',
        durationHours: this.toNumberOrDefault(pricingSnapshot.durationHours, this.calculateDurationHours(item.startDate, item.endDate)),
        billableDays: this.toNumberOrDefault(pricingSnapshot.billableDays, 0),
        billableHalfDays: this.toNumberOrDefault(pricingSnapshot.billableHalfDays, 0),
        overageHours: this.toNumberOrDefault(pricingSnapshot.overageHours, 0),
        unitPrice: Number(item.unitPrice),
        depositAmount: Number(item.depositAmount),
        bookingHoldAmount: Number(item.bookingHoldAmount),
        lineTotal: Number(item.lineTotal),
        appliedTierId: typeof pricingSnapshot.appliedTierId === 'string' ? pricingSnapshot.appliedTierId : null,
        appliedTier: pricingSnapshot.appliedTier ?? null,
      },
      note: item.note,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  toRentalOrderListItemOut(order: RentalOrderListItemWithRelations): RentalOrderListItemOutDto {
    const financialBreakdown = this.calculateFinancialBreakdown(order);

    return {
      id: order.id,
      code: order.code,
      source: order.source,
      status: order.status,
      paymentStatus: order.paymentStatus,
      refundStatus: order.refundStatus,
      customerSnapshot: order.customerSnapshot,
      startDate: order.startDate,
      endDate: order.endDate,
      deliveryFeeTotal: Number(order.deliveryFeeTotal),
      rentalFeeTotal: Number(order.rentalFeeTotal),
      depositTotal: Number(order.depositTotal),
      bookingHoldTotal: Number(order.bookingHoldTotal),
      lateFeeTotal: Number(order.lateFeeTotal),
      damageFeeTotal: Number(order.damageFeeTotal),
      discountTotal: Number(order.discountTotal),
      compensationFeeTotal: Number(order.compensationFeeTotal),
      chargeTotal: Number(order.chargeTotal),
      paidTotal: Number(order.paidTotal),
      estimatedRefundTotal: Number(order.estimatedRefundTotal),
      actualRefundTotal: Number(order.actualRefundTotal),
      handoverRequiredTotal: Number(order.handoverRequiredTotal),
      handoverAmountDue: Number(order.handoverAmountDue),
      ...financialBreakdown,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  calculateFinancialBreakdown(order: RentalOrderFinancialBreakdownInput): {
    rentalRevenueTotal: number;
    incidentFeeTotal: number;
    finalPayableTotal: number;
    refundDue: number;
    additionalChargeDue: number;
    settlementStatus: RentalOrderSettlementStatus;
  } {
    const rentalRevenueTotal = Math.max(
      Number(order.rentalFeeTotal) + Number(order.deliveryFeeTotal) - Number(order.discountTotal),
      0,
    );
    const incidentFeeTotal = Math.max(
      Number(order.lateFeeTotal) + Number(order.damageFeeTotal) + Number(order.compensationFeeTotal),
      0,
    );
    const finalPayableTotal = Math.max(rentalRevenueTotal + incidentFeeTotal, 0);
    const refundDue = Math.max(Number(order.paidTotal) - finalPayableTotal - Number(order.actualRefundTotal), 0);
    const additionalChargeDue = Math.max(finalPayableTotal + Number(order.actualRefundTotal) - Number(order.paidTotal), 0);
    const settlementStatus: RentalOrderSettlementStatus =
      additionalChargeDue > 0 ? 'NEED_COLLECT' : refundDue > 0 ? 'NEED_REFUND' : 'SETTLED';

    return {
      rentalRevenueTotal: Math.round(rentalRevenueTotal),
      incidentFeeTotal: Math.round(incidentFeeTotal),
      finalPayableTotal: Math.round(finalPayableTotal),
      refundDue: Math.round(refundDue),
      additionalChargeDue: Math.round(additionalChargeDue),
      settlementStatus,
    };
  }

  private buildUpdateOrderChanges(before: RentalOrderWithRelations, after: RentalOrderWithRelations): RentalOrderLogChange[] {
    return this.logsService.diffFields([
      {
        field: 'customerSnapshot.name',
        label: 'Tên khách',
        oldValue: this.getJsonPath(before.customerSnapshot, 'name'),
        newValue: this.getJsonPath(after.customerSnapshot, 'name'),
      },
      {
        field: 'customerSnapshot.phone',
        label: 'Số điện thoại',
        oldValue: this.getJsonPath(before.customerSnapshot, 'phone'),
        newValue: this.getJsonPath(after.customerSnapshot, 'phone'),
      },
      {
        field: 'customerSnapshot.email',
        label: 'Email',
        oldValue: this.getJsonPath(before.customerSnapshot, 'email'),
        newValue: this.getJsonPath(after.customerSnapshot, 'email'),
      },
      {
        field: 'customerSnapshot.address',
        label: 'Địa chỉ',
        oldValue: this.getJsonPath(before.customerSnapshot, 'address'),
        newValue: this.getJsonPath(after.customerSnapshot, 'address'),
      },
      {
        field: 'customerSnapshot.identityNumber',
        label: 'CCCD',
        oldValue: this.getJsonPath(before.customerSnapshot, 'identityNumber'),
        newValue: this.getJsonPath(after.customerSnapshot, 'identityNumber'),
      },
      {
        field: 'customerSnapshot.socialContact',
        label: 'Liên hệ MXH',
        oldValue: this.getJsonPath(before.customerSnapshot, 'socialContact'),
        newValue: this.getJsonPath(after.customerSnapshot, 'socialContact'),
      },
      { field: 'rentalPeriod.startDate', label: 'Giờ nhận', oldValue: before.startDate, newValue: after.startDate },
      { field: 'rentalPeriod.endDate', label: 'Giờ trả', oldValue: before.endDate, newValue: after.endDate },
      { field: 'fulfillment.pickupMethod', label: 'Hình thức nhận', oldValue: before.pickupMethod, newValue: after.pickupMethod },
      { field: 'fulfillment.deliveryAddress', label: 'Địa chỉ giao', oldValue: before.deliveryAddress, newValue: after.deliveryAddress },
      { field: 'financials.deliveryFeeTotal', label: 'Phí giao hàng', oldValue: before.deliveryFeeTotal, newValue: after.deliveryFeeTotal },
      { field: 'financials.rentalFeeTotal', label: 'Tiền thuê', oldValue: before.rentalFeeTotal, newValue: after.rentalFeeTotal },
      { field: 'financials.depositTotal', label: 'Cọc theo thiết bị', oldValue: before.depositTotal, newValue: after.depositTotal },
      { field: 'financials.bookingHoldTotal', label: 'Tiền giữ lịch', oldValue: before.bookingHoldTotal, newValue: after.bookingHoldTotal },
      { field: 'financials.discountTotal', label: 'Giảm giá', oldValue: before.discountTotal, newValue: after.discountTotal },
      { field: 'financials.chargeTotal', label: 'Tiền thuê cần thanh toán', oldValue: before.chargeTotal, newValue: after.chargeTotal },
      {
        field: 'financials.estimatedRefundTotal',
        label: 'Hoàn cọc dự tính',
        oldValue: before.estimatedRefundTotal,
        newValue: after.estimatedRefundTotal,
      },
      {
        field: 'financials.handoverRequiredTotal',
        label: 'Tổng cần thu khi bàn giao',
        oldValue: before.handoverRequiredTotal,
        newValue: after.handoverRequiredTotal,
      },
      { field: 'notes.customerNote', label: 'Ghi chú khách', oldValue: before.note, newValue: after.note },
      { field: 'notes.internalNote', label: 'Ghi chú nội bộ', oldValue: before.internalNote, newValue: after.internalNote },
      { field: 'items', label: 'Danh sách thiết bị', oldValue: this.getActiveItemAssetIds(before), newValue: this.getActiveItemAssetIds(after) },
    ]);
  }

  private getActiveItemAssetIds(order: RentalOrderWithRelations): string[] {
    return order.items
      .filter((item) => item.deletedAt === null && item.status !== RentalOrderItemStatus.CANCELLED)
      .map((item) => item.assetUnitId)
      .sort();
  }

  private getJsonPath(value: Prisma.JsonValue, key: string): unknown {
    if (!this.isRecord(value)) return null;
    return value[key] ?? null;
  }

  private hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  private toNumberOrDefault(value: unknown, fallback: number): number {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;

    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private calculateDurationHours(startDate: Date, endDate: Date): number {
    return Math.round(((endDate.getTime() - startDate.getTime()) / (60 * 60 * 1000)) * 100) / 100;
  }
}
