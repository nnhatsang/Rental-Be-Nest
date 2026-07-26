import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import {
  CustomerStatus,
  OrderEventType,
  OrderSource,
  OrderStatus,
  PaymentStatus,
  PickupMethod,
  UserActivityStatus,
} from '@generated/prisma/enums';
import { AssetUnitsService } from '../asset-units/asset-units.service';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from '../products/products.service';
import { RentalPolicyService } from '../rental-policy/rental-policy.service';
import { AssignRentalOrderAssetsDto, CancelRentalOrderDto, RentalOrderNoteDto } from './dto/rental-order-actions.dto';
import {
  CheckRentalOrderAvailabilityDto,
  RentalOrderAvailabilityOutDto,
} from './dto/check-rental-order-availability.dto';
import { CreateRentalOrderDto, RentalOrderItemInDto } from './dto/create-rental-order.dto';
import { GetAllRentalOrdersDto } from './dto/get-all-rental-orders.dto';
import { RentalOrderOutDto } from './dto/rental-order-out.dto';
import { UpdateRentalOrderDto } from './dto/update-rental-order.dto';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { DeleteRentalOrdersDto } from './dto/delete-rental-orders.dto';
import {
  RENTAL_ORDER_ASSET_UNIT_INVALID,
  RENTAL_ORDER_ASSIGNED_USER_INVALID,
  RENTAL_ORDER_CUSTOMER_INVALID,
  RENTAL_ORDER_NOT_FOUND,
  RENTAL_ORDER_PRODUCT_INVALID,
  RENTAL_ORDER_STATUS_TRANSITION_INVALID,
  RENTAL_ORDER_TIME_INVALID,
  RENTAL_ORDER_UNAVAILABLE,
} from '@/libs/constants/error.constants';
import { buildRentalOrderSearchText, normalizeSearchText } from '@/libs/utils/search-text.util';
import {
  AvailabilityAssetsOutDto,
  AvailabilityProductsOutDto,
  GetAvailabilityAssetsDto,
  GetAvailabilityProductsDto,
} from './dto/get-rental-order-availability.dto';
import { EAvailabilityChangeReason } from '@/libs/enums/socket.enum';
import {
  BLOCKING_ORDER_STATUSES,
  NormalizedRentalOrderItem,
  RentalOrderAvailabilityService,
} from './services/rental-order-availability.service';
import { RentalOrderPricingService } from './services/rental-order-pricing.service';
import { RentalOrderRealtimeService } from './services/rental-order-realtime.service';

const ASSIGN_ASSET_STATUSES = [OrderStatus.DRAFT, OrderStatus.CONFIRMED, OrderStatus.PREPARING];
const CANCELABLE_STATUSES = [OrderStatus.DRAFT, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP, OrderStatus.DELIVERING];
const SOFT_DELETABLE_STATUSES = [OrderStatus.DRAFT, OrderStatus.CANCELLED];

type RentalOrderWithRelations = Awaited<ReturnType<RentalOrdersService['findRentalOrderById']>>;
type ExistingRentalOrderWithRelations = NonNullable<RentalOrderWithRelations>;
type RentalProduct = Awaited<ReturnType<ProductsService['getActiveProductsForRental']>>[number];

@Injectable()
export class RentalOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly assetUnitsService: AssetUnitsService,
    private readonly rentalPolicyService: RentalPolicyService,
    private readonly availabilityService: RentalOrderAvailabilityService,
    private readonly pricingService: RentalOrderPricingService,
    private readonly realtimeService: RentalOrderRealtimeService,
  ) {}

  async checkRentalOrderAvailability(dto: CheckRentalOrderAvailabilityDto): Promise<RentalOrderAvailabilityOutDto> {
    return this.availabilityService.checkRentalOrderAvailability(dto);
  }

  async getAvailabilityProducts(dto: GetAvailabilityProductsDto): Promise<AvailabilityProductsOutDto> {
    return this.availabilityService.getAvailabilityProducts(dto);
  }

  async getAvailabilityAssets(dto: GetAvailabilityAssetsDto): Promise<AvailabilityAssetsOutDto> {
    return this.availabilityService.getAvailabilityAssets(dto);
  }

  async getAllRentalOrders(query: GetAllRentalOrdersDto) {
    const { search, customerId, assignedToId, status, paymentStatus, fromDate, toDate, page, perPage, sort, sortBy } = query;
    const skip = (page - 1) * perPage;
    const searchText = normalizeSearchText(search);

    const where: Prisma.RentalOrderWhereInput = {
      deletedAt: null,
      ...(customerId && { customerId }),
      ...(assignedToId && { assignedToId }),
      ...(status && { status }),
      ...(paymentStatus && { paymentStatus }),
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
        include: this.rentalOrderInclude(),
      }),
      this.prisma.rentalOrder.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toRentalOrderOut(item)),
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
    const rentalPolicy = await this.rentalPolicyService.getDefaultPolicyForOrder();
    const normalizedItems = this.normalizeItems(dto.items);
    const availability = await this.availabilityService.evaluateAvailability({
      startDate: dto.startDate,
      endDate: dto.endDate,
      items: normalizedItems,
      rentalPolicy,
    });

    this.assertAvailable(availability);

    const [customer, assignedTo, products] = await Promise.all([
      this.findCustomerForRental(dto.customerId),
      this.findAssignedUserForRental(dto.assignedToId),
      this.findProductsForItems(normalizedItems),
    ]);
    const pricedItems = this.pricingService.priceItems(normalizedItems, products, rentalPolicy, dto.startDate, dto.endDate);
    const totals = this.pricingService.calculateTotals(pricedItems, dto.deliveryFeeTotal ?? 0, dto.discountTotal ?? 0);

    const order = await this.prisma.$transaction(async (tx) => {
      const code = await this.generateOrderCode(tx);

      return tx.rentalOrder.create({
        data: {
          code,
          source: OrderSource.ADMIN,
          status: OrderStatus.DRAFT,
          paymentStatus: PaymentStatus.UNPAID,
          rentalPolicyId: rentalPolicy.id,
          customerId: customer.id,
          customerNameSnapshot: customer.name,
          customerPhoneSnapshot: customer.phone,
          customerEmailSnapshot: customer.email,
          customerAddressSnapshot: customer.address,
          customerIdentitySnapshot: customer.identityNumber,
          startDate: dto.startDate,
          endDate: dto.endDate,
          turnaroundMinutes: rentalPolicy.turnaroundMinutes,
          blockedEndDate: availability.blockedEndDate,
          pickupMethod: dto.pickupMethod ?? PickupMethod.PICKUP_AT_STORE,
          deliveryAddress: dto.deliveryAddress,
          deliveryFeeTotal: totals.deliveryFeeTotal,
          subtotal: totals.subtotal,
          depositTotal: totals.depositTotal,
          upfrontTotal: totals.upfrontTotal,
          bookingHoldTotal: totals.bookingHoldTotal,
          handoverDueTotal: totals.handoverDueTotal,
          discountTotal: totals.discountTotal,
          paidTotal: 0,
          remainingTotal: totals.upfrontTotal,
          refundTotal: totals.depositTotal,
          note: dto.note,
          internalNote: dto.internalNote,
          createdBy: currentUser.id,
          assignedToId: assignedTo?.id,
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
          statusHistories: {
            create: {
              fromStatus: null,
              toStatus: OrderStatus.DRAFT,
              createdBy: currentUser.id,
              note: 'Order created',
            },
          },
          events: {
            create: {
              type: OrderEventType.ORDER_CREATED,
              message: 'Order created',
              createdBy: currentUser.id,
            },
          },
        },
        include: this.rentalOrderInclude(),
      });
    });

    return this.toRentalOrderOut(order);
  }

  async updateRentalOrder(id: string, dto: UpdateRentalOrderDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    const existingOrder = await this.findExistingRentalOrderById(id);
    this.assertStatusIn(existingOrder.status, [OrderStatus.DRAFT]);

    const startDate = dto.startDate ?? existingOrder.startDate;
    const endDate = dto.endDate ?? existingOrder.endDate;
    const normalizedItems = dto.items ? this.normalizeItems(dto.items) : this.normalizeExistingItems(existingOrder.items);
    const rentalPolicy = await this.rentalPolicyService.getDefaultPolicyForOrder();
    const availability = await this.availabilityService.evaluateAvailability({
      startDate,
      endDate,
      items: normalizedItems,
      excludeOrderId: id,
      rentalPolicy,
    });

    this.assertAvailable(availability);

    const customer = dto.customerId ? await this.findCustomerForRental(dto.customerId) : existingOrder.customer;
    const assignedToId = this.hasOwn(dto, 'assignedToId') ? (dto.assignedToId ?? null) : existingOrder.assignedToId;
    const assignedTo = assignedToId ? await this.findAssignedUserForRental(assignedToId) : null;
    const products = await this.findProductsForItems(normalizedItems);
    const pricedItems = this.pricingService.priceItems(normalizedItems, products, rentalPolicy, startDate, endDate);
    const deliveryAddress = this.hasOwn(dto, 'deliveryAddress') ? (dto.deliveryAddress ?? null) : existingOrder.deliveryAddress;
    const note = this.hasOwn(dto, 'note') ? (dto.note ?? null) : existingOrder.note;
    const internalNote = this.hasOwn(dto, 'internalNote') ? (dto.internalNote ?? null) : existingOrder.internalNote;
    const deliveryFeeTotal = dto.deliveryFeeTotal ?? Number(existingOrder.deliveryFeeTotal);
    const discountTotal = dto.discountTotal ?? Number(existingOrder.discountTotal);
    const totals = this.pricingService.calculateTotals(pricedItems, deliveryFeeTotal, discountTotal);

    const order = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.rentalOrderItem.deleteMany({
          where: {
            orderId: id,
          },
        });

        await tx.rentalOrderItem.createMany({
          data: this.pricingService.toCreateManyOrderItemsData(id, pricedItems),
        });
      } else {
        for (const item of pricedItems) {
          if (!item.id) {
            continue;
          }

          await tx.rentalOrderItem.update({
            where: {
              id: item.id,
            },
            data: this.pricingService.toUpdateOrderItemData(item),
          });
        }
      }

      return tx.rentalOrder.update({
        where: { id },
        data: {
          customerId: customer.id,
          customerNameSnapshot: customer.name,
          customerPhoneSnapshot: customer.phone,
          customerEmailSnapshot: customer.email,
          customerAddressSnapshot: customer.address,
          customerIdentitySnapshot: customer.identityNumber,
          startDate,
          endDate,
          turnaroundMinutes: rentalPolicy.turnaroundMinutes,
          blockedEndDate: availability.blockedEndDate,
          pickupMethod: dto.pickupMethod,
          deliveryAddress,
          deliveryFeeTotal: totals.deliveryFeeTotal,
          subtotal: totals.subtotal,
          depositTotal: totals.depositTotal,
          upfrontTotal: totals.upfrontTotal,
          bookingHoldTotal: totals.bookingHoldTotal,
          handoverDueTotal: totals.handoverDueTotal,
          discountTotal: totals.discountTotal,
          remainingTotal: totals.upfrontTotal,
          refundTotal: totals.depositTotal,
          assignedToId: assignedTo?.id ?? null,
          note,
          internalNote,
          updatedBy: currentUser.id,
          searchText: this.buildOrderSearchText({
            code: existingOrder.code,
            customer,
            deliveryAddress,
            note,
            internalNote,
            cancelReason: existingOrder.cancelReason,
          }),
        },
        include: this.rentalOrderInclude(),
      });
    });

    return this.toRentalOrderOut(order);
  }

  async assignRentalOrderAssets(id: string, dto: AssignRentalOrderAssetsDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    const existingOrder = await this.findExistingRentalOrderById(id);
    this.assertStatusIn(existingOrder.status, ASSIGN_ASSET_STATUSES);

    const itemsById = new Map(existingOrder.items.map((item) => [item.id, item]));
    const assetUnitIds = dto.items.map((item) => item.assetUnitId);
    const [assetUnits, bookedAssetUnitIds] = await Promise.all([
      this.assetUnitsService.getAssignableAssetUnits(assetUnitIds),
      this.availabilityService.getBookedAssetUnitIds(assetUnitIds, existingOrder.startDate, existingOrder.blockedEndDate, id),
    ]);
    const assetUnitsById = new Map(assetUnits.map((assetUnit) => [assetUnit.id, assetUnit]));

    if (assetUnits.length !== new Set(assetUnitIds).size) {
      throw new BadRequestException(RENTAL_ORDER_ASSET_UNIT_INVALID);
    }

    for (const item of dto.items) {
      const orderItem = itemsById.get(item.itemId);
      const assetUnit = assetUnitsById.get(item.assetUnitId);

      if (!orderItem || !assetUnit || orderItem.productId !== assetUnit.productId || bookedAssetUnitIds.has(item.assetUnitId)) {
        throw new BadRequestException(RENTAL_ORDER_ASSET_UNIT_INVALID);
      }
    }

    const order = await this.prisma.$transaction(async (tx) => {
      await this.acquireAdvisoryLocks(tx, [
        `rental-order:${id}`,
        ...[...new Set(existingOrder.items.map((item) => item.productId))].map((productId) => `rental-product:${productId}`),
        ...assetUnitIds.map((assetUnitId) => `rental-asset:${assetUnitId}`),
      ]);
      const lockedOrder = await tx.rentalOrder.findFirst({
        where: { id, deletedAt: null },
        include: this.rentalOrderInclude(),
      });
      if (!lockedOrder) throw new NotFoundException(RENTAL_ORDER_NOT_FOUND);
      this.assertStatusIn(lockedOrder.status, ASSIGN_ASSET_STATUSES);
      const lockedBookedAssetUnitIds = await this.availabilityService.getBookedAssetUnitIds(assetUnitIds, lockedOrder.startDate, lockedOrder.blockedEndDate, id);
      if (assetUnitIds.some((assetUnitId) => lockedBookedAssetUnitIds.has(assetUnitId))) {
        throw new BadRequestException(RENTAL_ORDER_ASSET_UNIT_INVALID);
      }

      for (const item of dto.items) {
        await tx.rentalOrderItem.update({
          where: {
            id: item.itemId,
          },
          data: {
            assetUnitId: item.assetUnitId,
          },
        });
      }

      await tx.rentalOrder.update({
        where: { id },
        data: {
          updatedBy: currentUser.id,
        },
      });

      return tx.rentalOrder.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: this.rentalOrderInclude(),
      });
    });

    if (!order) {
      throw new NotFoundException(RENTAL_ORDER_NOT_FOUND);
    }

    if (BLOCKING_ORDER_STATUSES.includes(order.status)) {
      this.realtimeService.emitAvailabilityChanged(EAvailabilityChangeReason.ORDER_UPDATED, order.items);
    }

    return this.toRentalOrderOut(order);
  }

  async confirmRentalOrder(id: string, dto: RentalOrderNoteDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    const order = await this.prisma.$transaction(async (tx) => {
      await this.acquireAdvisoryLocks(tx, [`rental-order:${id}`]);
      const existingOrder = await tx.rentalOrder.findFirst({
        where: { id, deletedAt: null },
        include: this.rentalOrderInclude(),
      });
      if (!existingOrder) throw new NotFoundException(RENTAL_ORDER_NOT_FOUND);
      this.assertStatusIn(existingOrder.status, [OrderStatus.DRAFT]);

      await this.acquireAdvisoryLocks(
        tx,
        [...new Set(existingOrder.items.map((item) => item.productId))].map((productId) => `rental-product:${productId}`),
      );
      const availability = await this.availabilityService.evaluateAvailability({
        startDate: existingOrder.startDate,
        endDate: existingOrder.endDate,
        items: this.normalizeExistingItems(existingOrder.items),
        excludeOrderId: id,
        turnaroundMinutes: existingOrder.turnaroundMinutes,
      });
      this.assertAvailable(availability);

      return this.transitionOrderStatusInTransaction(tx, {
        order: existingOrder,
        nextStatus: OrderStatus.CONFIRMED,
        currentUserId: currentUser.id,
        note: dto.note,
        eventType: OrderEventType.ORDER_CONFIRMED,
        eventMessage: 'Order confirmed',
      });
    });

    this.realtimeService.emitAvailabilityChanged(EAvailabilityChangeReason.ORDER_CONFIRMED, order.items);

    return this.toRentalOrderOut(order);
  }

  async cancelRentalOrder(id: string, dto: CancelRentalOrderDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    const existingOrder = await this.findExistingRentalOrderById(id);
    this.assertStatusIn(existingOrder.status, CANCELABLE_STATUSES);

    const order = await this.prisma.$transaction(async (tx) => {
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: existingOrder.status,
          toStatus: OrderStatus.CANCELLED,
          createdBy: currentUser.id,
          note: dto.cancelReason,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: OrderEventType.ORDER_CANCELLED,
          message: dto.cancelReason,
          createdBy: currentUser.id,
        },
      });

      return tx.rentalOrder.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: dto.cancelReason,
          searchText: this.buildOrderSearchText({
            code: existingOrder.code,
            customer: existingOrder.customer,
            deliveryAddress: existingOrder.deliveryAddress,
            note: existingOrder.note,
            internalNote: existingOrder.internalNote,
            cancelReason: dto.cancelReason,
          }),
        },
        include: this.rentalOrderInclude(),
      });
    });

    if (BLOCKING_ORDER_STATUSES.includes(existingOrder.status)) {
      this.realtimeService.emitAvailabilityChanged(EAvailabilityChangeReason.ORDER_CANCELLED, order.items);
    }

    return this.toRentalOrderOut(order);
  }

  async deleteRentalOrders(dto: DeleteRentalOrdersDto, userId: string): Promise<{ success: true }> {
    const uniqueIds = [...new Set(dto.rentalOrderIds)];
    if (uniqueIds.length === 0) {
      return { success: true };
    }

    const orders = await this.prisma.rentalOrder.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, status: true },
    });

    for (const order of orders) {
      this.assertStatusIn(order.status, SOFT_DELETABLE_STATUSES);
    }

    await this.prisma.rentalOrder.updateMany({
      where: { id: { in: uniqueIds } },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    return { success: true };
  }

  private async transitionOrderStatusInTransaction(
    tx: Prisma.TransactionClient,
    params: {
      order: ExistingRentalOrderWithRelations;
      nextStatus: OrderStatus;
      currentUserId: string;
      note?: string;
      eventType: OrderEventType;
      eventMessage: string;
    },
  ): Promise<ExistingRentalOrderWithRelations> {
    await tx.orderStatusHistory.create({
      data: {
        orderId: params.order.id,
        fromStatus: params.order.status,
        toStatus: params.nextStatus,
        createdBy: params.currentUserId,
        note: params.note,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: params.order.id,
        type: params.eventType,
        message: params.eventMessage,
        createdBy: params.currentUserId,
      },
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

  private async acquireAdvisoryLocks(tx: Prisma.TransactionClient, keys: string[]): Promise<void> {
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

  private normalizeExistingItems(items: ExistingRentalOrderWithRelations['items']): NormalizedRentalOrderItem[] {
    return items.map((item) => ({
      id: item.id,
      productId: item.productId,
      assetUnitId: item.assetUnitId,
      note: item.note,
    }));
  }

  private assertAvailable(availability: RentalOrderAvailabilityOutDto): void {
    if (!availability.isAvailable) {
      throw new BadRequestException({
        ...RENTAL_ORDER_UNAVAILABLE,
        error: availability.unavailableItems,
      });
    }
  }

  private assertStatusIn(status: OrderStatus, allowedStatuses: OrderStatus[]): void {
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

  private async findAssignedUserForRental(assignedToId?: string | null) {
    if (!assignedToId) {
      return null;
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: assignedToId,
        deletedAt: null,
        activityStatus: UserActivityStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new BadRequestException(RENTAL_ORDER_ASSIGNED_USER_INVALID);
    }

    return user;
  }

  private async findProductsForItems(items: NormalizedRentalOrderItem[]): Promise<RentalProduct[]> {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await this.productsService.getActiveProductsForRental(productIds);

    if (products.length !== productIds.length) {
      throw new BadRequestException(RENTAL_ORDER_PRODUCT_INVALID);
    }

    return products;
  }

  private async findExistingRentalOrderById(id: string): Promise<ExistingRentalOrderWithRelations> {
    const order = await this.findRentalOrderById(id);

    if (!order) {
      throw new NotFoundException(RENTAL_ORDER_NOT_FOUND);
    }

    return order;
  }

  private async findRentalOrderById(id: string) {
    return this.prisma.rentalOrder.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: this.rentalOrderInclude(),
    });
  }

  private rentalOrderInclude() {
    return {
      customer: true,
      assignedTo: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
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
    } as const;
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

  private buildOrderSearchText(input: {
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

  private toRentalOrderOut(order: ExistingRentalOrderWithRelations): RentalOrderOutDto {
    return {
      id: order.id,
      code: order.code,
      source: order.source,
      status: order.status,
      paymentStatus: order.paymentStatus,
      rentalPolicyId: order.rentalPolicyId,
      customer: {
        id: order.customer.id,
        name: order.customer.name,
        phone: order.customer.phone,
        email: order.customer.email,
      },
      customerNameSnapshot: order.customerNameSnapshot,
      customerPhoneSnapshot: order.customerPhoneSnapshot,
      customerEmailSnapshot: order.customerEmailSnapshot,
      customerAddressSnapshot: order.customerAddressSnapshot,
      customerIdentitySnapshot: order.customerIdentitySnapshot,
      startDate: order.startDate,
      endDate: order.endDate,
      turnaroundMinutes: order.turnaroundMinutes,
      blockedEndDate: order.blockedEndDate,
      actualReturnDate: order.actualReturnDate,
      pickupMethod: order.pickupMethod,
      deliveryAddress: order.deliveryAddress,
      deliveryFeeTotal: order.deliveryFeeTotal.toString(),
      subtotal: order.subtotal.toString(),
      depositTotal: order.depositTotal.toString(),
      upfrontTotal: order.upfrontTotal.toString(),
      bookingHoldTotal: order.bookingHoldTotal.toString(),
      handoverDueTotal: order.handoverDueTotal.toString(),
      lateFeeTotal: order.lateFeeTotal.toString(),
      damageFeeTotal: order.damageFeeTotal.toString(),
      discountTotal: order.discountTotal.toString(),
      paidTotal: order.paidTotal.toString(),
      remainingTotal: order.remainingTotal.toString(),
      refundTotal: order.refundTotal.toString(),
      note: order.note,
      internalNote: order.internalNote,
      cancelReason: order.cancelReason,
      createdBy: order.createdBy,
      assignedTo: order.assignedTo,
      items: order.items.map((item) => ({
        id: item.id,
        product: {
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
        },
        assetUnit: item.assetUnit
          ? {
              id: item.assetUnit.id,
              serialNumber: item.assetUnit.serialNumber,
            }
          : null,
        productNameSnapshot: item.productNameSnapshot,
        skuSnapshot: item.skuSnapshot,
        unitPrice: item.unitPrice.toString(),
        bookingHoldAmount: item.bookingHoldAmount.toString(),
        upfrontAmount: item.upfrontAmount.toString(),
        refundableDepositAmount: item.refundableDepositAmount.toString(),
        depositAmount: item.depositAmount.toString(),
        lineTotal: item.lineTotal.toString(),
        note: item.note,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      deletedAt: order.deletedAt,
    };
  }

  private hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

}
