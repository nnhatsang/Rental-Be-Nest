import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { CustomerStatus, OrderEventType, OrderSource, OrderStatus, PaymentStatus, PickupMethod, UserActivityStatus } from '@generated/prisma/enums';
import { AssetUnitsService } from '../asset-units/asset-units.service';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from '../products/products.service';
import { RentalPolicyService } from '../rental-policy/rental-policy.service';
import { StoreBusinessHoursService } from '../store-business-hours/store-business-hours.service';
import { StoreClosureService } from '../store-closure/store-closure.service';
import { AssignRentalOrderAssetsDto, CancelRentalOrderDto, RentalOrderNoteDto } from './dto/rental-order-actions.dto';
import {
  CheckRentalOrderAvailabilityDto,
  RentalOrderAvailabilityOutDto,
  RentalOrderUnavailableItemDto,
} from './dto/check-rental-order-availability.dto';
import { CreateRentalOrderDto, RentalOrderItemInDto } from './dto/create-rental-order.dto';
import { GetAllRentalOrdersDto } from './dto/get-all-rental-orders.dto';
import { RentalOrderOutDto } from './dto/rental-order-out.dto';
import { UpdateRentalOrderDto } from './dto/update-rental-order.dto';
import { AuthUser } from '@modules/auth/types/auth-user.type';
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

const BLOCKING_ORDER_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.DELIVERING,
  OrderStatus.RENTING,
  OrderStatus.OVERDUE,
];

const ASSIGN_ASSET_STATUSES = [OrderStatus.DRAFT, OrderStatus.CONFIRMED, OrderStatus.PREPARING];
const CANCELABLE_STATUSES = [
  OrderStatus.DRAFT,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.DELIVERING,
];
const SOFT_DELETABLE_STATUSES = [OrderStatus.DRAFT, OrderStatus.CANCELLED];

type RentalOrderWithRelations = Awaited<ReturnType<RentalOrdersService['findRentalOrderById']>>;
type ExistingRentalOrderWithRelations = NonNullable<RentalOrderWithRelations>;
type RentalProduct = Awaited<ReturnType<ProductsService['getActiveProductsForRental']>>[number];
type RentalPolicy = Awaited<ReturnType<RentalPolicyService['getDefaultPolicyForOrder']>>;
type NormalizedRentalOrderItem = {
  id?: string;
  productId: string;
  assetUnitId?: string | null;
  quantity: number;
  note?: string | null;
};
type PricedRentalOrderItem = NormalizedRentalOrderItem & {
  productNameSnapshot: string;
  skuSnapshot: string | null;
  unitPrice: number;
  bookingHoldAmount: number;
  upfrontAmount: number;
  refundableDepositAmount: number;
  depositAmount: number;
  lineTotal: number;
};

@Injectable()
export class RentalOrdersService {
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

  async getAllRentalOrders(query: GetAllRentalOrdersDto) {
    const { search, customerId, assignedToId, status, paymentStatus, fromDate, toDate, page, perPage } = query;
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
        orderBy: {
          createdAt: 'desc',
        },
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
    const availability = await this.evaluateAvailability({
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
    const pricedItems = this.priceItems(normalizedItems, products, rentalPolicy, dto.startDate, dto.endDate);
    const totals = this.calculateTotals(pricedItems, dto.deliveryFeeTotal ?? 0, dto.discountTotal ?? 0);

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
          holdExpiresAt: this.addMinutes(new Date(), rentalPolicy.holdPaymentExpiresInMinutes),
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
          createdById: currentUser.id,
          assignedToId: assignedTo?.id,
          searchText: this.buildOrderSearchText({
            code,
            customer,
            deliveryAddress: dto.deliveryAddress,
            note: dto.note,
            internalNote: dto.internalNote,
          }),
          items: {
            create: this.toCreateOrderItemsData(pricedItems),
          },
          statusHistories: {
            create: {
              fromStatus: null,
              toStatus: OrderStatus.DRAFT,
              changedById: currentUser.id,
              note: 'Order created',
            },
          },
          events: {
            create: {
              type: OrderEventType.ORDER_CREATED,
              message: 'Order created',
              createdById: currentUser.id,
            },
          },
        },
        include: this.rentalOrderInclude(),
      });
    });

    return this.toRentalOrderOut(order);
  }

  async updateRentalOrder(id: string, dto: UpdateRentalOrderDto): Promise<RentalOrderOutDto> {
    const existingOrder = await this.findExistingRentalOrderById(id);
    this.assertStatusIn(existingOrder.status, [OrderStatus.DRAFT]);

    const startDate = dto.startDate ?? existingOrder.startDate;
    const endDate = dto.endDate ?? existingOrder.endDate;
    const normalizedItems = dto.items ? this.normalizeItems(dto.items) : this.normalizeExistingItems(existingOrder.items);
    const rentalPolicy = await this.rentalPolicyService.getDefaultPolicyForOrder();
    const availability = await this.evaluateAvailability({
      startDate,
      endDate,
      items: normalizedItems,
      excludeOrderId: id,
      rentalPolicy,
    });

    this.assertAvailable(availability);

    const customer = dto.customerId ? await this.findCustomerForRental(dto.customerId) : existingOrder.customer;
    const assignedToId = this.hasOwn(dto, 'assignedToId') ? dto.assignedToId ?? null : existingOrder.assignedToId;
    const assignedTo = assignedToId ? await this.findAssignedUserForRental(assignedToId) : null;
    const products = await this.findProductsForItems(normalizedItems);
    const pricedItems = this.priceItems(normalizedItems, products, rentalPolicy, startDate, endDate);
    const deliveryAddress = this.hasOwn(dto, 'deliveryAddress') ? dto.deliveryAddress ?? null : existingOrder.deliveryAddress;
    const note = this.hasOwn(dto, 'note') ? dto.note ?? null : existingOrder.note;
    const internalNote = this.hasOwn(dto, 'internalNote') ? dto.internalNote ?? null : existingOrder.internalNote;
    const deliveryFeeTotal = dto.deliveryFeeTotal ?? Number(existingOrder.deliveryFeeTotal);
    const discountTotal = dto.discountTotal ?? Number(existingOrder.discountTotal);
    const totals = this.calculateTotals(pricedItems, deliveryFeeTotal, discountTotal);

    const order = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.rentalOrderItem.deleteMany({
          where: {
            orderId: id,
          },
        });

        await tx.rentalOrderItem.createMany({
          data: this.toCreateManyOrderItemsData(id, pricedItems),
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
            data: this.toUpdateOrderItemData(item),
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

  async assignRentalOrderAssets(id: string, dto: AssignRentalOrderAssetsDto): Promise<RentalOrderOutDto> {
    const existingOrder = await this.findExistingRentalOrderById(id);
    this.assertStatusIn(existingOrder.status, ASSIGN_ASSET_STATUSES);

    const itemsById = new Map(existingOrder.items.map((item) => [item.id, item]));
    const assetUnitIds = dto.items.map((item) => item.assetUnitId);
    const [assetUnits, bookedAssetUnitIds] = await Promise.all([
      this.assetUnitsService.getAssignableAssetUnits(assetUnitIds),
      this.getBookedAssetUnitIds(assetUnitIds, existingOrder.startDate, existingOrder.blockedEndDate, id),
    ]);
    const assetUnitsById = new Map(assetUnits.map((assetUnit) => [assetUnit.id, assetUnit]));

    if (assetUnits.length !== new Set(assetUnitIds).size) {
      throw new BadRequestException(RENTAL_ORDER_ASSET_UNIT_INVALID);
    }

    for (const item of dto.items) {
      const orderItem = itemsById.get(item.itemId);
      const assetUnit = assetUnitsById.get(item.assetUnitId);

      if (!orderItem || orderItem.quantity !== 1 || !assetUnit || orderItem.productId !== assetUnit.productId || bookedAssetUnitIds.has(item.assetUnitId)) {
        throw new BadRequestException(RENTAL_ORDER_ASSET_UNIT_INVALID);
      }
    }

    const order = await this.prisma.$transaction(async (tx) => {
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

    return this.toRentalOrderOut(order);
  }

  async confirmRentalOrder(id: string, dto: RentalOrderNoteDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    const existingOrder = await this.findExistingRentalOrderById(id);
    this.assertStatusIn(existingOrder.status, [OrderStatus.DRAFT]);

    const availability = await this.evaluateAvailability({
      startDate: existingOrder.startDate,
      endDate: existingOrder.endDate,
      items: this.normalizeExistingItems(existingOrder.items),
      excludeOrderId: id,
      turnaroundMinutes: existingOrder.turnaroundMinutes,
    });
    this.assertAvailable(availability);

    const order = await this.transitionOrderStatus({
      order: existingOrder,
      nextStatus: OrderStatus.CONFIRMED,
      currentUserId: currentUser.id,
      note: dto.note,
      eventType: OrderEventType.ORDER_CONFIRMED,
      eventMessage: 'Order confirmed',
    });

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
          changedById: currentUser.id,
          note: dto.cancelReason,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: OrderEventType.ORDER_CANCELLED,
          message: dto.cancelReason,
          createdById: currentUser.id,
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

    return this.toRentalOrderOut(order);
  }

  async deleteRentalOrder(id: string): Promise<{ success: true }> {
    const existingOrder = await this.findExistingRentalOrderById(id);
    this.assertStatusIn(existingOrder.status, SOFT_DELETABLE_STATUSES);

    await this.prisma.rentalOrder.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return { success: true };
  }

  private async evaluateAvailability(params: {
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

    const requestedQuantityByProduct = this.sumRequestedQuantityByProduct(params.items);
    for (const [productId, requestedQuantity] of requestedQuantityByProduct.entries()) {
      const product = productsById.get(productId);
      if (!product) {
        throw new BadRequestException(RENTAL_ORDER_PRODUCT_INVALID);
      }

      const assignableAssetCount = assignableAssetCountByProduct.get(productId) ?? 0;
      const availableStock = assignableAssetCount > 0 ? assignableAssetCount : product.stockQuantity;
      const bookedQuantity = bookedQuantityByProduct.get(productId) ?? 0;

      if (bookedQuantity + requestedQuantity > availableStock) {
        unavailableItems.push({
          productId,
          assetUnitId: null,
          reason: 'Product quantity is not enough in this time range',
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

  private async transitionOrderStatus(params: {
    order: ExistingRentalOrderWithRelations;
    nextStatus: OrderStatus;
    currentUserId: string;
    note?: string;
    eventType: OrderEventType;
    eventMessage: string;
  }): Promise<ExistingRentalOrderWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      await tx.orderStatusHistory.create({
        data: {
          orderId: params.order.id,
          fromStatus: params.order.status,
          toStatus: params.nextStatus,
          changedById: params.currentUserId,
          note: params.note,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: params.order.id,
          type: params.eventType,
          message: params.eventMessage,
          createdById: params.currentUserId,
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
    });
  }

  private normalizeItems(items: RentalOrderItemInDto[]): NormalizedRentalOrderItem[] {
    return items.map((item) => ({
      productId: item.productId,
      assetUnitId: item.assetUnitId,
      quantity: item.quantity ?? 1,
      note: item.note,
    }));
  }

  private normalizeExistingItems(items: ExistingRentalOrderWithRelations['items']): NormalizedRentalOrderItem[] {
    return items.map((item) => ({
      id: item.id,
      productId: item.productId,
      assetUnitId: item.assetUnitId,
      quantity: item.quantity,
      note: item.note,
    }));
  }

  private validateRentalTime(startDate: Date, endDate: Date): void {
    if (startDate >= endDate) {
      throw new BadRequestException(RENTAL_ORDER_TIME_INVALID);
    }
  }

  private validateRequestedItems(items: NormalizedRentalOrderItem[]): void {
    const assetUnitIds = new Set<string>();

    for (const item of items) {
      if (item.quantity < 1) {
        throw new BadRequestException(RENTAL_ORDER_PRODUCT_INVALID);
      }

      if (!item.assetUnitId) {
        continue;
      }

      if (item.quantity !== 1 || assetUnitIds.has(item.assetUnitId)) {
        throw new BadRequestException(RENTAL_ORDER_ASSET_UNIT_INVALID);
      }

      assetUnitIds.add(item.assetUnitId);
    }
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

  private priceItems(items: NormalizedRentalOrderItem[], products: RentalProduct[], rentalPolicy: RentalPolicy, startDate: Date, endDate: Date): PricedRentalOrderItem[] {
    const productsById = new Map(products.map((product) => [product.id, product]));

    return items.map((item) => {
      const product = productsById.get(item.productId);

      if (!product) {
        throw new BadRequestException(RENTAL_ORDER_PRODUCT_INVALID);
      }

      const unitPrice = this.calculateRentalUnitPrice(product, startDate, endDate);
      const depositAmount = Number(product.depositAmount);

      return {
        ...item,
        productNameSnapshot: product.name,
        skuSnapshot: product.sku,
        unitPrice,
        bookingHoldAmount: Number(rentalPolicy.bookingHoldAmountPerUnit),
        upfrontAmount: unitPrice + depositAmount,
        refundableDepositAmount: depositAmount,
        depositAmount,
        lineTotal: unitPrice * item.quantity,
      };
    });
  }

  private calculateRentalUnitPrice(product: RentalProduct, startDate: Date, endDate: Date): number {
    const durationHours = Math.ceil((endDate.getTime() - startDate.getTime()) / (60 * 60 * 1000));

    if (durationHours <= 6) {
      return Number(product.halfDayPrice ?? product.dailyPrice);
    }

    if (durationHours <= 24) {
      return Number(product.dailyPrice);
    }

    const fullDays = Math.floor(durationHours / 24);
    const extraHours = durationHours - fullDays * 24;

    if (product.hourlyOveragePrice && extraHours > 0) {
      return this.getTierDailyPrice(product, fullDays) * fullDays + Number(product.hourlyOveragePrice) * extraHours;
    }

    const billableDays = Math.ceil(durationHours / 24);
    return this.getTierDailyPrice(product, billableDays) * billableDays;
  }

  private getTierDailyPrice(product: RentalProduct, days: number): number {
    const tier = product.rentalPriceTiers.find((priceTier) => {
      const maxDays = priceTier.maxDays ?? Number.POSITIVE_INFINITY;
      return priceTier.minDays <= days && days <= maxDays;
    });

    return Number(tier?.dailyPrice ?? product.dailyPrice);
  }

  private calculateTotals(items: PricedRentalOrderItem[], deliveryFeeTotal: number, discountTotal: number) {
    const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
    const depositTotal = items.reduce((total, item) => total + item.depositAmount * item.quantity, 0);
    const bookingHoldTotal = items.reduce((total, item) => total + item.bookingHoldAmount * item.quantity, 0);
    const upfrontTotal = Math.max(subtotal + depositTotal + deliveryFeeTotal - discountTotal, 0);

    return {
      subtotal,
      depositTotal,
      deliveryFeeTotal,
      discountTotal,
      bookingHoldTotal,
      upfrontTotal,
      handoverDueTotal: Math.max(upfrontTotal - bookingHoldTotal, 0),
    };
  }

  private toCreateOrderItemsData(items: PricedRentalOrderItem[]): Prisma.RentalOrderItemCreateWithoutOrderInput[] {
    return items.map((item) => ({
      product: {
        connect: {
          id: item.productId,
        },
      },
      assetUnit: item.assetUnitId
        ? {
            connect: {
              id: item.assetUnitId,
            },
          }
        : undefined,
      quantity: item.quantity,
      productNameSnapshot: item.productNameSnapshot,
      skuSnapshot: item.skuSnapshot,
      unitPrice: item.unitPrice,
      bookingHoldAmount: item.bookingHoldAmount,
      upfrontAmount: item.upfrontAmount,
      refundableDepositAmount: item.refundableDepositAmount,
      depositAmount: item.depositAmount,
      lineTotal: item.lineTotal,
      note: item.note,
    }));
  }

  private toCreateManyOrderItemsData(orderId: string, items: PricedRentalOrderItem[]): Prisma.RentalOrderItemCreateManyInput[] {
    return items.map((item) => ({
      orderId,
      productId: item.productId,
      assetUnitId: item.assetUnitId,
      quantity: item.quantity,
      productNameSnapshot: item.productNameSnapshot,
      skuSnapshot: item.skuSnapshot,
      unitPrice: item.unitPrice,
      bookingHoldAmount: item.bookingHoldAmount,
      upfrontAmount: item.upfrontAmount,
      refundableDepositAmount: item.refundableDepositAmount,
      depositAmount: item.depositAmount,
      lineTotal: item.lineTotal,
      note: item.note,
    }));
  }

  private toUpdateOrderItemData(item: PricedRentalOrderItem): Prisma.RentalOrderItemUpdateInput {
    return {
      product: {
        connect: {
          id: item.productId,
        },
      },
      assetUnit: item.assetUnitId
        ? {
            connect: {
              id: item.assetUnitId,
            },
          }
        : {
            disconnect: true,
          },
      quantity: item.quantity,
      productNameSnapshot: item.productNameSnapshot,
      skuSnapshot: item.skuSnapshot,
      unitPrice: item.unitPrice,
      bookingHoldAmount: item.bookingHoldAmount,
      upfrontAmount: item.upfrontAmount,
      refundableDepositAmount: item.refundableDepositAmount,
      depositAmount: item.depositAmount,
      lineTotal: item.lineTotal,
      note: item.note,
    };
  }

  private async getBookedAssetUnitIds(assetUnitIds: string[], startDate: Date, blockedEndDate: Date, excludeOrderId?: string): Promise<Set<string>> {
    const uniqueAssetUnitIds = [...new Set(assetUnitIds)];

    if (uniqueAssetUnitIds.length === 0) {
      return new Set();
    }

    const bookedItems = await this.prisma.rentalOrderItem.findMany({
      where: {
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

  private async getBookedQuantityByProduct(productIds: string[], startDate: Date, blockedEndDate: Date, excludeOrderId?: string): Promise<Map<string, number>> {
    const uniqueProductIds = [...new Set(productIds)];

    if (uniqueProductIds.length === 0) {
      return new Map();
    }

    const bookedItems = await this.prisma.rentalOrderItem.groupBy({
      by: ['productId'],
      where: {
        productId: {
          in: uniqueProductIds,
        },
        order: this.blockingOrderWhere(startDate, blockedEndDate, excludeOrderId),
      },
      _sum: {
        quantity: true,
      },
    });

    return new Map(bookedItems.map((item) => [item.productId, item._sum.quantity ?? 0]));
  }

  private blockingOrderWhere(startDate: Date, blockedEndDate: Date, excludeOrderId?: string): Prisma.RentalOrderWhereInput {
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

  private sumRequestedQuantityByProduct(items: NormalizedRentalOrderItem[]): Map<string, number> {
    const requestedQuantityByProduct = new Map<string, number>();

    for (const item of items) {
      requestedQuantityByProduct.set(item.productId, (requestedQuantityByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    return requestedQuantityByProduct;
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
      createdBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
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
      holdExpiresAt: order.holdExpiresAt,
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
        quantity: item.quantity,
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

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }
}
