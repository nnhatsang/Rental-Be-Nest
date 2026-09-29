import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import {
  CustomerStatus,
  HandoverStatus,
  OrderSource,
  OrderStatus,
  PaymentDirection,
  PaymentMethod,
  PaymentTransactionStatus,
  PickupMethod,
  RentalAllocationStatus,
  RentalChargeKind,
  RentalChargeStatus,
  RentalInspectionCondition,
  RentalInspectionType,
  RentalRefundStatus,
  RentalSettlementStatus,
  ReturnStatus,
} from '@generated/prisma/enums';
import {
  INCORRECT_INPUT,
  RENTAL_ORDER_CUSTOMER_INVALID,
  RENTAL_ORDER_HANDOVER_PAYMENT_INSUFFICIENT,
  RENTAL_ORDER_NOT_FOUND,
  RENTAL_ORDER_PRODUCT_INVALID,
  RENTAL_ORDER_REFUND_AMOUNT_INVALID,
  RENTAL_ORDER_UNAVAILABLE,
} from '@/libs/constants/error.constants';
import { buildRentalOrderSearchText, normalizeSearchText } from '@/libs/utils/search-text.util';
import { AuthUser } from '@/modules/auth/types/auth-user.type';
import { PrismaService } from '@/modules/database/prisma.service';
import { SystemSettingsService } from '@/modules/system-settings/system-settings.service';
import { assertRentalOrderTransition, getRentalOrderOverdue } from './domain/rental-order-state-machine';
import { RentalOrderAvailabilityService } from './services/rental-order-availability.service';
import { RentalOrderFinancialService } from './services/rental-order-financial.service';
import { RentalOrderPricingService } from './services/rental-order-pricing.service';
import { CreateRentalOrderDto, CreateRentalQuoteDto, RentalOrderItemDto } from './dto/create-rental-order.dto';
import { RentalOrderUnavailableItemDto } from './dto/rental-order-unavailable-item.dto';
import { DeleteRentalOrdersDto } from './dto/delete-rental-orders.dto';
import { GetAllRentalOrdersDto, RentalOrderSortBy } from './dto/get-all-rental-orders.dto';
import {
  CancelRentalOrderDto,
  CreateRefundDto,
  HandoverRentalOrderDto,
  InspectRentalOrderDto,
  RecordRentalOrderPaymentDto,
  RejectPaymentDto,
  ReturnRentalOrderDto,
  SettleRentalOrderDto,
} from './dto/rental-order-actions.dto';
import {
  RentalOrderChargeOutDto,
  RentalOrderFinancialsOutDto,
  RentalOrderLineOutDto,
  RentalOrderListItemOutDto,
  RentalOrderOutDto,
  RentalOrderPaymentOutDto,
  RentalOrderQuoteOutDto,
  RentalOrderRefundOutDto,
} from './dto/rental-order-out.dto';
import { UpdateRentalOrderCustomerSnapshotDto, UpdateRentalOrderDto } from './dto/update-rental-order.dto';

const orderDetailInclude = {
  customer: true,
  lines: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          _count: {
            select: {
              assetUnits: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      },
      allocations: {
        orderBy: { createdAt: 'asc' },
        include: { assetUnit: { select: { id: true, serialNumber: true } } },
      },
    },
  },
  charges: { orderBy: { createdAt: 'asc' } },
  paymentTransactions: { orderBy: { createdAt: 'asc' } },
  refunds: { orderBy: { createdAt: 'asc' } },
  inspections: {
    orderBy: { inspectedAt: 'asc' },
    include: { items: { include: { accessories: true } } },
  },
  statusHistories: { orderBy: { createdAt: 'asc' } },
} as const satisfies Prisma.RentalOrderInclude;

type RentalOrderDetailRecord = Prisma.RentalOrderGetPayload<{ include: typeof orderDetailInclude }>;
type PreparedQuote = Awaited<ReturnType<RentalOrdersService['prepareQuote']>>;
type DbClient = Prisma.TransactionClient;
type RentalOrderCustomerSnapshotValue = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  identityNumber: string | null;
  socialContact: string | null;
};

@Injectable()
export class RentalOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: RentalOrderAvailabilityService,
    private readonly pricingService: RentalOrderPricingService,
    private readonly financialService: RentalOrderFinancialService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  async getAllRentalOrders(query: GetAllRentalOrdersDto) {
    const searchText = normalizeSearchText(query.search);
    const where: Prisma.RentalOrderWhereInput = {
      deletedAt: null,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.settlementStatus ? { settlementStatus: query.settlementStatus } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.pickupMethod ? { pickupMethod: query.pickupMethod } : {}),
      ...(query.fromDate || query.toDate
        ? { startDate: { ...(query.fromDate ? { gte: query.fromDate } : {}), ...(query.toDate ? { lte: query.toDate } : {}) } }
        : {}),
      ...(searchText ? { searchText: { contains: searchText } } : {}),
    };
    const field = this.sortField(query.sortBy);
    const orderBy = { [field]: query.sort } as Prisma.RentalOrderOrderByWithRelationInput;
    const skip = (query.page - 1) * query.perPage;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.rentalOrder.findMany({
        where,
        skip,
        take: query.perPage,
        orderBy: [orderBy, { id: 'asc' }],
        select: {
          id: true,
          code: true,
          source: true,
          pickupMethod: true,
          status: true,
          handoverStatus: true,
          returnStatus: true,
          settlementStatus: true,
          customerSnapshot: true,
          startDate: true,
          endDate: true,
          actualReturnDate: true,
          rentalFeeTotal: true,
          deliveryFeeTotal: true,
          bookingHoldTotal: true,
          securityDepositTotal: true,
          totalCustomerObligation: true,
          paidTotal: true,
          amountDueBeforeHandover: true,
          refundDue: true,
          additionalChargeDue: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.rentalOrder.count({ where }),
    ]);

    return { items: items.map((item) => this.toListOut(item)), total, page: query.page, perPage: query.perPage };
  }

  async getRentalOrderById(id: string): Promise<RentalOrderOutDto> {
    return this.toDetailOut(await this.findDetailOrThrow(id));
  }

  async createRentalQuote(dto: CreateRentalQuoteDto, user: AuthUser): Promise<RentalOrderQuoteOutDto> {
    const prepared = await this.prepareQuote(dto);
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const quote = await this.prisma.rentalOrderQuote.create({
      data: {
        customerId: dto.customerId,
        source: OrderSource.ADMIN,
        startDate: dto.startDate,
        endDate: dto.endDate,
        pickupMethod: dto.pickupMethod as PickupMethod,
        deliveryAddress: dto.deliveryAddress,
        requestSnapshot: this.jsonValue(this.quoteRequestSnapshot(dto)),
        responseSnapshot: this.jsonValue({
          availability: prepared.availability,
          lines: prepared.lines.map((line) => this.quoteLineOut(line)),
          summary: prepared.totals,
        }),
        policyVersion: prepared.policyVersion,
        expiresAt,
        createdBy: user.id,
      },
    });

    return {
      quoteId: quote.id,
      expiresAt: quote.expiresAt,
      policyVersion: quote.policyVersion,
      availability: prepared.availability,
      lines: prepared.lines.map((line) => this.quoteLineOut(line)),
      summary: prepared.totals,
    };
  }

  async createRentalOrder(dto: CreateRentalOrderDto, user: AuthUser): Promise<RentalOrderOutDto> {
    const quote = await this.prisma.rentalOrderQuote.findUnique({ where: { id: dto.quoteId } });
    if (!quote || quote.consumedAt || quote.expiresAt <= new Date()) {
      throw new BadRequestException(RENTAL_ORDER_UNAVAILABLE);
    }
    const request = this.parseQuoteRequest(quote.requestSnapshot);
    if (!request.customerId) {
      throw new BadRequestException(RENTAL_ORDER_CUSTOMER_INVALID);
    }
    const prepared = await this.prepareQuote({ ...request, excludeOrderId: undefined });
    if (!prepared.availability.available) {
      throw new BadRequestException(RENTAL_ORDER_UNAVAILABLE);
    }
    const customer = await this.findCustomerOrThrow(request.customerId);
    const orderId = await this.prisma.$transaction(async (tx) => {
      const code = await this.generateOrderCode();
      const order = await tx.rentalOrder.create({
        data: {
          code,
          source: OrderSource.ADMIN,
          status: OrderStatus.CREATED,
          handoverStatus: HandoverStatus.PENDING_PAYMENT,
          returnStatus: ReturnStatus.NOT_RETURNED,
          settlementStatus: RentalSettlementStatus.NOT_STARTED,
          settingsSnapshot: this.jsonValue(prepared.settingsSnapshot),
          policyVersion: prepared.policyVersion,
          customerId: customer.id,
          customerSnapshot: this.jsonValue(this.customerSnapshot(customer)),
          startDate: request.startDate,
          endDate: request.endDate,
          pickupMethod: request.pickupMethod as PickupMethod,
          deliveryAddress: request.deliveryAddress,
          note: dto.note,
          internalNote: dto.internalNote,
          searchText: buildRentalOrderSearchText({
            code,
            customerName: customer.name,
            customerPhone: customer.phone,
            customerEmail: customer.email,
            customerIdentityNumber: customer.identityNumber,
            customerSocialContact: customer.socialContact,
            deliveryAddress: request.deliveryAddress,
            note: dto.note,
            internalNote: dto.internalNote,
          }),
          createdBy: user.id,
          quoteId: quote.id,
          lines: {
            create: prepared.lines.map((line) => ({
              productId: line.product.id,
              quantity: line.quantity,
              unitRentalFee: line.pricing.unitRentalFee,
              unitDepositAmount: line.pricing.unitDepositAmount,
              unitBookingHoldAmount: line.pricing.unitBookingHoldAmount,
              lineRentalTotal: line.pricing.lineRentalTotal,
              lineDepositTotal: line.pricing.lineDepositTotal,
              lineBookingHoldTotal: line.pricing.lineBookingHoldTotal,
              pricingSnapshot: this.jsonValue(line.pricing),
              accessoriesSnapshot: line.product.includedAccessories ? this.jsonValue({ text: line.product.includedAccessories }) : undefined,
              note: line.note,
              allocations: {
                create: line.assetUnitIds.map((assetUnitId) => ({
                  assetUnitId,
                  source: 'AUTO_ALLOCATED' as const,
                  status: RentalAllocationStatus.RESERVED,
                  startDate: request.startDate,
                  endDate: request.endDate,
                  blockedEndDate: prepared.blockedEndDate,
                  allocatedAt: new Date(),
                })),
              },
            })),
          },
        },
        include: { lines: true },
      });
      await tx.rentalOrderCharge.createMany({
        data: [
          ...order.lines.flatMap((line) => [
            {
              orderId: order.id,
              orderLineId: line.id,
              kind: RentalChargeKind.RENTAL_FEE,
              amount: line.lineRentalTotal,
              status: RentalChargeStatus.OPEN,
              refundable: false,
            },
            {
              orderId: order.id,
              orderLineId: line.id,
              kind: RentalChargeKind.BOOKING_HOLD,
              amount: line.lineBookingHoldTotal,
              status: RentalChargeStatus.OPEN,
              refundable: false,
            },
            {
              orderId: order.id,
              orderLineId: line.id,
              kind: RentalChargeKind.SECURITY_DEPOSIT,
              amount: line.lineDepositTotal,
              status: RentalChargeStatus.OPEN,
              refundable: true,
            },
          ]),
          ...(prepared.totals.deliveryFeeTotal > 0
            ? [
                {
                  orderId: order.id,
                  kind: RentalChargeKind.DELIVERY_FEE,
                  amount: prepared.totals.deliveryFeeTotal,
                  status: RentalChargeStatus.OPEN,
                  refundable: false,
                },
              ]
            : []),
        ],
      });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: null, toStatus: OrderStatus.CREATED, note: 'Order created from quote', createdBy: user.id },
      });
      await tx.rentalOrderQuote.update({ where: { id: quote.id }, data: { consumedAt: new Date() } });
      await this.financialService.recalculateOrder(order.id, tx);
      return order.id;
    });

    return this.getRentalOrderById(orderId);
  }

  async updateRentalOrder(id: string, dto: UpdateRentalOrderDto, user: AuthUser): Promise<RentalOrderOutDto> {
    const existing = await this.prisma.rentalOrder.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException(RENTAL_ORDER_NOT_FOUND);
    if (existing.status !== OrderStatus.CREATED) throw new BadRequestException(INCORRECT_INPUT);
    const successfulPayment = await this.prisma.paymentTransaction.count({ where: { orderId: id, status: PaymentTransactionStatus.SUCCESS } });
    if (successfulPayment > 0) throw new BadRequestException(INCORRECT_INPUT);

    const existingCustomerSnapshot = existing.customerSnapshot as unknown as RentalOrderCustomerSnapshotValue;
    const nextCustomerSnapshot = dto.customerSnapshot ? this.customerSnapshotFromUpdate(dto.customerSnapshot) : existingCustomerSnapshot;
    const nextNote = dto.note !== undefined ? dto.note : existing.note;
    const nextInternalNote = dto.internalNote !== undefined ? dto.internalNote : existing.internalNote;
    const hasScheduleChange = Boolean(
      dto.quoteId || dto.items || dto.startDate || dto.endDate || dto.pickupMethod || dto.deliveryAddress !== undefined,
    );
    if (hasScheduleChange && !dto.quoteId) throw new BadRequestException(RENTAL_ORDER_UNAVAILABLE);

    if (!dto.quoteId) {
      await this.prisma.rentalOrder.update({
        where: { id },
        data: {
          ...(dto.customerSnapshot ? { customerSnapshot: this.jsonValue(nextCustomerSnapshot) } : {}),
          note: nextNote,
          internalNote: nextInternalNote,
          updatedBy: user.id,
          searchText: buildRentalOrderSearchText({
            code: existing.code,
            customerName: nextCustomerSnapshot.name,
            customerPhone: nextCustomerSnapshot.phone,
            customerEmail: nextCustomerSnapshot.email,
            customerIdentityNumber: nextCustomerSnapshot.identityNumber,
            customerSocialContact: nextCustomerSnapshot.socialContact,
            deliveryAddress: existing.deliveryAddress,
            note: nextNote,
            internalNote: nextInternalNote,
            cancelReason: existing.cancelReason,
          }),
        },
      });
      return this.getRentalOrderById(id);
    }

    const quote = await this.prisma.rentalOrderQuote.findUnique({ where: { id: dto.quoteId } });
    if (!quote || quote.expiresAt <= new Date() || quote.consumedAt) throw new BadRequestException(RENTAL_ORDER_UNAVAILABLE);
    const request = this.parseQuoteRequest(quote.requestSnapshot);
    if (request.customerId !== existing.customerId) throw new BadRequestException(INCORRECT_INPUT);
    const prepared = await this.prepareQuote({ ...request, customerId: existing.customerId, excludeOrderId: id });
    if (!prepared.availability.available) throw new BadRequestException(RENTAL_ORDER_UNAVAILABLE);

    await this.prisma.$transaction(async (tx) => {
      await tx.rentalOrderCharge.deleteMany({ where: { orderId: id } });
      await tx.rentalOrderLine.deleteMany({ where: { orderId: id } });
      const lines = await Promise.all(
        prepared.lines.map((line) =>
          tx.rentalOrderLine.create({
            data: {
              orderId: id,
              productId: line.product.id,
              quantity: line.quantity,
              unitRentalFee: line.pricing.unitRentalFee,
              unitDepositAmount: line.pricing.unitDepositAmount,
              unitBookingHoldAmount: line.pricing.unitBookingHoldAmount,
              lineRentalTotal: line.pricing.lineRentalTotal,
              lineDepositTotal: line.pricing.lineDepositTotal,
              lineBookingHoldTotal: line.pricing.lineBookingHoldTotal,
              pricingSnapshot: this.jsonValue(line.pricing),
              accessoriesSnapshot: line.product.includedAccessories ? this.jsonValue({ text: line.product.includedAccessories }) : undefined,
              note: line.note,
              allocations: {
                create: line.assetUnitIds.map((assetUnitId) => ({
                  assetUnitId,
                  source: 'AUTO_ALLOCATED' as const,
                  status: RentalAllocationStatus.RESERVED,
                  startDate: request.startDate,
                  endDate: request.endDate,
                  blockedEndDate: prepared.blockedEndDate,
                  allocatedAt: new Date(),
                })),
              },
            },
          }),
        ),
      );
      await tx.rentalOrderCharge.createMany({
        data: [
          ...lines.flatMap((line) => [
            {
              orderId: id,
              orderLineId: line.id,
              kind: RentalChargeKind.RENTAL_FEE,
              amount: line.lineRentalTotal,
              status: RentalChargeStatus.OPEN,
              refundable: false,
            },
            {
              orderId: id,
              orderLineId: line.id,
              kind: RentalChargeKind.BOOKING_HOLD,
              amount: line.lineBookingHoldTotal,
              status: RentalChargeStatus.OPEN,
              refundable: false,
            },
            {
              orderId: id,
              orderLineId: line.id,
              kind: RentalChargeKind.SECURITY_DEPOSIT,
              amount: line.lineDepositTotal,
              status: RentalChargeStatus.OPEN,
              refundable: true,
            },
          ]),
          ...(prepared.totals.deliveryFeeTotal > 0
            ? [
                {
                  orderId: id,
                  kind: RentalChargeKind.DELIVERY_FEE,
                  amount: prepared.totals.deliveryFeeTotal,
                  status: RentalChargeStatus.OPEN,
                  refundable: false,
                },
              ]
            : []),
        ],
      });
      await tx.rentalOrder.update({
        where: { id },
        data: {
          customerSnapshot: this.jsonValue(nextCustomerSnapshot),
          startDate: request.startDate,
          endDate: request.endDate,
          pickupMethod: request.pickupMethod as PickupMethod,
          deliveryAddress: request.deliveryAddress,
          note: nextNote,
          internalNote: nextInternalNote,
          quoteId: quote.id,
          updatedBy: user.id,
          searchText: buildRentalOrderSearchText({
            code: existing.code,
            customerName: nextCustomerSnapshot.name,
            customerPhone: nextCustomerSnapshot.phone,
            customerEmail: nextCustomerSnapshot.email,
            customerIdentityNumber: nextCustomerSnapshot.identityNumber,
            customerSocialContact: nextCustomerSnapshot.socialContact,
            deliveryAddress: request.deliveryAddress,
            note: nextNote,
            internalNote: nextInternalNote,
            cancelReason: existing.cancelReason,
          }),
        },
      });
      await tx.rentalOrderQuote.update({ where: { id: quote.id }, data: { consumedAt: new Date() } });
      await this.financialService.recalculateOrder(id, tx);
    });

    return this.getRentalOrderById(id);
  }

  async deleteRentalOrders(dto: DeleteRentalOrdersDto, user: AuthUser): Promise<{ success: true }> {
    const ids = [...new Set(dto.rentalOrderIds)];
    await this.prisma.$transaction(async (tx) => {
      const orders = await tx.rentalOrder.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, status: true } });
      if (orders.some((order) => order.status !== OrderStatus.CREATED && order.status !== OrderStatus.CANCELLED))
        throw new BadRequestException(INCORRECT_INPUT);
      await tx.rentalAssetAllocation.updateMany({
        where: { orderLine: { orderId: { in: ids } } },
        data: { status: RentalAllocationStatus.RELEASED, releasedAt: new Date() },
      });
      await tx.rentalOrder.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date(), deletedBy: user.id, updatedBy: user.id } });
    });
    return { success: true };
  }

  async cancelRentalOrder(id: string, dto: CancelRentalOrderDto, user: AuthUser): Promise<RentalOrderOutDto> {
    const order = await this.prisma.rentalOrder.findFirst({ where: { id, deletedAt: null } });
    if (!order) throw new NotFoundException(RENTAL_ORDER_NOT_FOUND);
    if (order.status !== OrderStatus.CREATED && order.status !== OrderStatus.CONFIRMED) throw new BadRequestException(INCORRECT_INPUT);
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException(INCORRECT_INPUT);

    await this.prisma.$transaction(async (tx) => {
      const allowRefund = dto.allowRefund ?? dto.refundBookingHold ?? false;
      if (allowRefund) {
        const [payments, refunds] = await Promise.all([
          tx.paymentTransaction.findMany({
            where: { orderId: id, direction: PaymentDirection.INBOUND, status: PaymentTransactionStatus.SUCCESS },
            select: { amount: true },
          }),
          tx.refund.findMany({
            where: {
              orderId: id,
              status: { in: [RentalRefundStatus.PENDING, RentalRefundStatus.PROCESSING, RentalRefundStatus.REFUNDED] },
            },
            select: { amount: true },
          }),
        ]);
        const paidTotal = payments.reduce((total, payment) => total + Number(payment.amount), 0);
        const refundedTotal = refunds.reduce((total, refund) => total + Number(refund.amount), 0);
        const availableRefund = Math.max(0, paidTotal - refundedTotal);
        const refundAmount = dto.refundAmount ?? availableRefund;
        if (refundAmount > availableRefund) {
          const formatAmount = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
          throw new BadRequestException({
            code: RENTAL_ORDER_REFUND_AMOUNT_INVALID.code,
            message: `Số tiền hoàn yêu cầu ${formatAmount(refundAmount)} đồng, nhưng số tiền tối đa có thể hoàn là ${formatAmount(availableRefund)} đồng.`,
          });
        }

        await tx.rentalOrderCharge.updateMany({
          where: {
            orderId: id,
            kind: {
              in: [RentalChargeKind.BOOKING_HOLD, RentalChargeKind.RENTAL_FEE, RentalChargeKind.DELIVERY_FEE, RentalChargeKind.SECURITY_DEPOSIT],
            },
            status: { notIn: [RentalChargeStatus.CANCELLED, RentalChargeStatus.WAIVED] },
          },
          data: { status: RentalChargeStatus.CANCELLED, refundable: true },
        });
        if (refundAmount > 0) {
          await tx.refund.create({
            data: {
              orderId: id,
              amount: refundAmount,
              status: RentalRefundStatus.PENDING,
              method: PaymentMethod.BANK_TRANSFER,
              note: dto.note,
              createdBy: user.id,
            },
          });
        }
      } else {
        await tx.rentalOrderCharge.updateMany({
          where: {
            orderId: id,
            kind: { in: [RentalChargeKind.RENTAL_FEE, RentalChargeKind.DELIVERY_FEE, RentalChargeKind.SECURITY_DEPOSIT] },
            status: { notIn: [RentalChargeStatus.CANCELLED, RentalChargeStatus.WAIVED] },
          },
          data: { status: RentalChargeStatus.CANCELLED },
        });
        await tx.rentalOrderCharge.updateMany({
          where: { orderId: id, kind: RentalChargeKind.BOOKING_HOLD },
          data: { kind: RentalChargeKind.CANCELLATION_FEE, refundable: false },
        });
      }
      await tx.rentalAssetAllocation.updateMany({
        where: { orderLine: { orderId: id } },
        data: { status: RentalAllocationStatus.RELEASED, releasedAt: new Date() },
      });
      assertRentalOrderTransition(order.status, OrderStatus.CANCELLED);
      await tx.rentalOrder.update({ where: { id }, data: { status: OrderStatus.CANCELLED, cancelReason: reason, updatedBy: user.id } });
      await tx.orderStatusHistory.create({
        data: { orderId: id, fromStatus: order.status, toStatus: OrderStatus.CANCELLED, note: dto.note ?? reason, createdBy: user.id },
      });
      await this.financialService.recalculateOrder(id, tx);
    });
    return this.getRentalOrderById(id);
  }

  async recordPayment(id: string, dto: RecordRentalOrderPaymentDto, user: AuthUser): Promise<RentalOrderOutDto> {
    await this.findActionableOrder(id);
    const status = dto.status ?? PaymentTransactionStatus.PENDING;
    const paymentId = await this.prisma.$transaction(async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await tx.paymentTransaction.findFirst({ where: { orderId: id, idempotencyKey: dto.idempotencyKey } });
        if (existing) return existing.id;
      }
      const payment = await tx.paymentTransaction.create({
        data: {
          orderId: id,
          direction: PaymentDirection.INBOUND,
          amount: dto.amount,
          method: dto.method,
          status,
          referenceCode: dto.referenceCode,
          idempotencyKey: dto.idempotencyKey,
          metadata: dto.note ? this.jsonValue({ note: dto.note }) : undefined,
          createdBy: user.id,
        },
      });
      if (status === PaymentTransactionStatus.SUCCESS) await this.financialService.allocatePayment(payment.id, tx);
      await this.financialService.recalculateOrder(id, tx);
      if (status === PaymentTransactionStatus.SUCCESS) await this.promoteToConfirmedIfReady(id, user.id, tx);
      return payment.id;
    });
    void paymentId;
    return this.getRentalOrderById(id);
  }

  async confirmPayment(id: string, paymentId: string, user: AuthUser): Promise<RentalOrderOutDto> {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.paymentTransaction.findFirst({ where: { id: paymentId, orderId: id } });
      if (!payment || payment.status !== PaymentTransactionStatus.PENDING) throw new BadRequestException(INCORRECT_INPUT);
      await tx.paymentTransaction.update({ where: { id: paymentId }, data: { status: PaymentTransactionStatus.SUCCESS, updatedAt: new Date() } });
      await this.financialService.allocatePayment(paymentId, tx);
      await this.financialService.recalculateOrder(id, tx);
      await this.promoteToConfirmedIfReady(id, user.id, tx);
    });
    return this.getRentalOrderById(id);
  }

  async rejectPayment(id: string, paymentId: string, dto: RejectPaymentDto): Promise<RentalOrderOutDto> {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.paymentTransaction.findFirst({ where: { id: paymentId, orderId: id } });
      if (!payment || payment.status !== PaymentTransactionStatus.PENDING) throw new BadRequestException(INCORRECT_INPUT);
      await tx.paymentTransaction.update({
        where: { id: paymentId },
        data: { status: PaymentTransactionStatus.FAILED, metadata: dto.note ? this.jsonValue({ note: dto.note }) : undefined },
      });
    });
    return this.getRentalOrderById(id);
  }

  async createRefund(id: string, dto: CreateRefundDto, user: AuthUser): Promise<RentalOrderOutDto> {
    await this.financialService.recalculateOrder(id);
    const order = await this.prisma.rentalOrder.findFirst({ where: { id, deletedAt: null } });
    if (!order) throw new NotFoundException(RENTAL_ORDER_NOT_FOUND);
    const pendingRefundStatuses: RentalRefundStatus[] = [RentalRefundStatus.PENDING, RentalRefundStatus.PROCESSING];
    const pendingRefunds = await this.prisma.refund.aggregate({
      where: { orderId: id, status: { in: pendingRefundStatuses } },
      _sum: { amount: true },
    });
    const pendingRefundTotal = Number(pendingRefunds._sum.amount ?? 0);
    const available = Math.max(0, Number(order.refundDue) - pendingRefundTotal);
    if (dto.amount > available) {
      const formatAmount = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
      throw new BadRequestException({
        code: RENTAL_ORDER_REFUND_AMOUNT_INVALID.code,
        message:
          available > 0
            ? `Số tiền hoàn yêu cầu ${formatAmount(dto.amount)} đồng, nhưng số tiền còn có thể tạo yêu cầu hoàn là ${formatAmount(available)} đồng.`
            : pendingRefundTotal > 0
              ? `Đơn đã có yêu cầu hoàn ${formatAmount(pendingRefundTotal)} đồng đang chờ xác nhận. Vui lòng xác nhận khoản hoàn hiện tại trước khi tạo yêu cầu mới.`
              : 'Đơn không còn khoản tiền nào có thể tạo yêu cầu hoàn.',
      });
    }
    await this.prisma.refund.create({
      data: {
        orderId: id,
        amount: dto.amount,
        status: RentalRefundStatus.PENDING,
        method: dto.method,
        referenceCode: dto.referenceCode,
        note: dto.note,
        createdBy: user.id,
      },
    });
    return this.getRentalOrderById(id);
  }

  async confirmRefund(id: string, refundId: string): Promise<RentalOrderOutDto> {
    await this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.findFirst({ where: { id: refundId, orderId: id } });
      if (!refund || (refund.status !== RentalRefundStatus.PENDING && refund.status !== RentalRefundStatus.PROCESSING))
        throw new BadRequestException(INCORRECT_INPUT);
      await tx.refund.update({ where: { id: refundId }, data: { status: RentalRefundStatus.REFUNDED } });
      await this.financialService.recalculateOrder(id, tx);
    });
    return this.getRentalOrderById(id);
  }

  async handoverOrder(id: string, dto: HandoverRentalOrderDto, user: AuthUser): Promise<RentalOrderOutDto> {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.rentalOrder.findFirst({ where: { id, deletedAt: null }, include: { lines: { include: { allocations: true } } } });
      if (!order) throw new NotFoundException(RENTAL_ORDER_NOT_FOUND);
      if (order.status !== OrderStatus.CONFIRMED) throw new BadRequestException(INCORRECT_INPUT);
      const allocationCount = order.lines.reduce(
        (total, line) => total + line.allocations.filter((allocation) => allocation.status !== RentalAllocationStatus.RELEASED).length,
        0,
      );
      const requiredCount = order.lines.reduce((total, line) => total + line.quantity, 0);
      if (allocationCount < requiredCount || Number(order.amountDueBeforeHandover) > 0)
        throw new BadRequestException(RENTAL_ORDER_HANDOVER_PAYMENT_INSUFFICIENT);
      assertRentalOrderTransition(order.status, OrderStatus.RENTING);
      await tx.rentalAssetAllocation.updateMany({ where: { orderLine: { orderId: id } }, data: { status: RentalAllocationStatus.HANDED_OVER } });
      await tx.rentalOrder.update({
        where: { id },
        data: {
          status: OrderStatus.RENTING,
          handoverStatus: HandoverStatus.HANDED_OVER,
          actualPickupDate: dto.actualPickupDate ?? new Date(),
          updatedBy: user.id,
        },
      });
      await tx.rentalInspection.create({
        data: {
          orderId: id,
          type: RentalInspectionType.HANDOVER,
          inspectedBy: user.id,
          note: dto.note,
          items: {
            create: order.lines.flatMap((line) =>
              line.allocations.map((allocation) => ({ allocationId: allocation.id, condition: RentalInspectionCondition.GOOD })),
            ),
          },
        },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: id, fromStatus: order.status, toStatus: OrderStatus.RENTING, note: dto.note ?? 'Handover completed', createdBy: user.id },
      });
    });
    return this.getRentalOrderById(id);
  }

  async returnOrder(id: string, dto: ReturnRentalOrderDto, user: AuthUser): Promise<RentalOrderOutDto> {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.rentalOrder.findFirst({ where: { id, deletedAt: null } });
      if (!order) throw new NotFoundException(RENTAL_ORDER_NOT_FOUND);
      if (order.status !== OrderStatus.RENTING) throw new BadRequestException(INCORRECT_INPUT);
      assertRentalOrderTransition(order.status, OrderStatus.RETURNED);
      await tx.rentalAssetAllocation.updateMany({
        where: { orderLine: { orderId: id }, status: RentalAllocationStatus.HANDED_OVER },
        data: { status: RentalAllocationStatus.RETURNED },
      });
      await tx.rentalOrder.update({
        where: { id },
        data: {
          status: OrderStatus.RETURNED,
          returnStatus: ReturnStatus.RETURNED,
          actualReturnDate: dto.actualReturnDate ?? new Date(),
          updatedBy: user.id,
        },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: id, fromStatus: order.status, toStatus: OrderStatus.RETURNED, note: dto.note ?? 'Equipment returned', createdBy: user.id },
      });
    });
    return this.getRentalOrderById(id);
  }

  async inspectOrder(id: string, dto: InspectRentalOrderDto, user: AuthUser): Promise<RentalOrderOutDto> {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.rentalOrder.findFirst({
        where: { id, deletedAt: null },
        include: { lines: { include: { allocations: { include: { orderLine: { include: { product: true } } } } } } },
      });
      if (!order) throw new NotFoundException(RENTAL_ORDER_NOT_FOUND);
      if (order.status !== OrderStatus.RETURNED || order.returnStatus !== ReturnStatus.RETURNED) throw new BadRequestException(INCORRECT_INPUT);
      const allocations = order.lines.flatMap((line) => line.allocations);
      const allocationIds = new Set(allocations.map((allocation) => allocation.id));
      const inspectedAllocationIds = new Set(dto.items.map((item) => item.allocationId));
      if (
        dto.items.length !== allocations.length ||
        inspectedAllocationIds.size !== allocations.length ||
        dto.items.some((item) => !allocationIds.has(item.allocationId))
      )
        throw new BadRequestException(INCORRECT_INPUT);
      if (dto.items.some((item) => item.accessories?.some((accessory) => accessory.actualQuantity > accessory.expectedQuantity)))
        throw new BadRequestException(INCORRECT_INPUT);
      const existingInspection = await tx.rentalInspection.findFirst({ where: { orderId: id, type: RentalInspectionType.RETURN } });
      if (existingInspection) throw new BadRequestException(INCORRECT_INPUT);
      await tx.rentalInspection.create({
        data: {
          orderId: id,
          type: RentalInspectionType.RETURN,
          inspectedBy: user.id,
          note: dto.note,
          items: {
            create: dto.items.map((item) => ({
              allocationId: item.allocationId,
              condition: item.condition,
              note: item.note,
              accessories: {
                create: (item.accessories ?? []).map((accessory) => ({
                  name: accessory.name,
                  expectedQuantity: accessory.expectedQuantity,
                  actualQuantity: accessory.actualQuantity,
                  status: accessory.status,
                  note: accessory.note,
                })),
              },
            })),
          },
        },
      });

      const allocationById = new Map(allocations.map((allocation) => [allocation.id, allocation]));
      const incidents: Array<{
        orderId: string;
        allocationId: string;
        type: 'DAMAGE' | 'LOSS' | 'LATE_RETURN' | 'MISSING_ACCESSORY';
        amount: number;
        note?: string;
        createdBy: string;
        metadata?: Prisma.InputJsonValue;
      }> = [];
      for (const item of dto.items) {
        const allocation = allocationById.get(item.allocationId);
        if (!allocation) continue;
        const replacementValue = Number(allocation.orderLine.product.replacementValue ?? 0);
        if (item.condition === RentalInspectionCondition.DAMAGED || item.condition === RentalInspectionCondition.MISSING) {
          incidents.push({
            orderId: id,
            allocationId: item.allocationId,
            type: item.condition === RentalInspectionCondition.MISSING ? 'LOSS' : 'DAMAGE',
            amount: item.condition === RentalInspectionCondition.MISSING ? replacementValue : Math.round(replacementValue * 0.25 * 100) / 100,
            note: item.note,
            createdBy: user.id,
          });
        }
        for (const accessory of item.accessories ?? []) {
          if (accessory.actualQuantity < accessory.expectedQuantity || accessory.status === 'DAMAGED') {
            incidents.push({
              orderId: id,
              allocationId: item.allocationId,
              type: 'MISSING_ACCESSORY',
              amount: 0,
              note: accessory.note ?? accessory.name,
              createdBy: user.id,
              metadata: this.jsonValue({
                name: accessory.name,
                expectedQuantity: accessory.expectedQuantity,
                actualQuantity: accessory.actualQuantity,
              }),
            });
          }
        }
      }
      const actualReturnDate = order.actualReturnDate ?? new Date();
      if (actualReturnDate > order.endDate) {
        const hoursLate = Math.ceil((actualReturnDate.getTime() - order.endDate.getTime()) / 3_600_000);
        for (const allocation of allocations) {
          const hourlyRate = Number(allocation.orderLine.product.hourlyOveragePrice ?? Number(allocation.orderLine.product.dailyPrice) / 24);
          incidents.push({
            orderId: id,
            allocationId: allocation.id,
            type: 'LATE_RETURN',
            amount: Math.round(hourlyRate * hoursLate * 100) / 100,
            note: `Late ${hoursLate} hour(s)`,
            createdBy: user.id,
          });
        }
      }
      if (incidents.length) {
        await tx.rentalIncident.createMany({ data: incidents });
        const chargeRows = incidents
          .filter((incident) => incident.amount > 0)
          .map((incident) => ({
            orderId: id,
            kind: incident.type === 'LATE_RETURN' ? RentalChargeKind.LATE_FEE : RentalChargeKind.DAMAGE_COMPENSATION,
            amount: incident.amount,
            status: RentalChargeStatus.OPEN,
            refundable: false,
            metadata: incident.metadata ?? this.jsonValue({ incidentType: incident.type, allocationId: incident.allocationId }),
          }));
        if (chargeRows.length) await tx.rentalOrderCharge.createMany({ data: chargeRows });
      }
      await tx.rentalOrder.update({ where: { id }, data: { returnStatus: ReturnStatus.INSPECTED, updatedBy: user.id } });
      await this.financialService.recalculateOrder(id, tx);
    });
    return this.getRentalOrderById(id);
  }

  async settleOrder(id: string, dto: SettleRentalOrderDto, user: AuthUser): Promise<RentalOrderOutDto> {
    await this.financialService.recalculateOrder(id);
    const order = await this.prisma.rentalOrder.findFirst({ where: { id, deletedAt: null } });
    if (!order) throw new NotFoundException(RENTAL_ORDER_NOT_FOUND);
    if (
      order.returnStatus !== ReturnStatus.INSPECTED ||
      order.settlementStatus !== RentalSettlementStatus.SETTLED ||
      Number(order.additionalChargeDue) > 0 ||
      Number(order.refundDue) > 0
    )
      throw new BadRequestException(INCORRECT_INPUT);
    if (order.status !== OrderStatus.RETURNED) throw new BadRequestException(INCORRECT_INPUT);
    await this.prisma.$transaction(async (tx) => {
      assertRentalOrderTransition(order.status, OrderStatus.DONE);
      await tx.rentalOrder.update({
        where: { id },
        data: { status: OrderStatus.DONE, settlementStatus: RentalSettlementStatus.SETTLED, updatedBy: user.id },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: id, fromStatus: order.status, toStatus: OrderStatus.DONE, note: dto.note ?? 'Order settled', createdBy: user.id },
      });
    });
    return this.getRentalOrderById(id);
  }

  private async prepareQuote(input: CreateRentalQuoteDto): Promise<{
    blockedEndDate: Date;
    availability: { available: boolean; conflicts: RentalOrderUnavailableItemDto[] };
    lines: Array<ReturnType<RentalOrderPricingService['buildQuoteLines']>[number]>;
    totals: ReturnType<RentalOrderPricingService['calculateTotals']>;
    settingsSnapshot: unknown;
    policyVersion: string;
  }> {
    const settings = await this.systemSettingsService.getDefaultSettingsForOrder();
    const itemsByProduct = new Map<string, RentalOrderItemDto>();
    for (const item of input.items) {
      const current = itemsByProduct.get(item.productId);
      itemsByProduct.set(item.productId, {
        productId: item.productId,
        quantity: (current?.quantity ?? 0) + item.quantity,
        note: item.note ?? current?.note,
      });
    }
    const requestedItems = [...itemsByProduct.values()];
    const productIds = requestedItems.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, deletedAt: null, isActive: true },
      include: { rentalPriceTiers: { where: { deletedAt: null }, orderBy: [{ minDays: 'asc' }, { id: 'asc' }] } },
    });
    if (products.length !== productIds.length) throw new BadRequestException(RENTAL_ORDER_PRODUCT_INVALID);
    const productById = new Map(products.map((product) => [product.id, product]));
    const availability = await this.availabilityService.selectAvailableAssets({
      startDate: input.startDate,
      endDate: input.endDate,
      items: requestedItems,
      excludeOrderId: input.excludeOrderId,
    });
    const allocationByProduct = new Map(availability.allocations.map((allocation) => [allocation.productId, allocation]));
    const selections = requestedItems.map((item) => {
      const product = productById.get(item.productId);
      const allocation = allocationByProduct.get(item.productId);
      if (!product || !allocation) throw new BadRequestException(RENTAL_ORDER_PRODUCT_INVALID);
      return { product, assetUnitIds: allocation.assetUnitIds, quantity: item.quantity, note: item.note };
    });
    const lines = this.pricingService.buildQuoteLines({
      selections,
      startDate: input.startDate,
      endDate: input.endDate,
      bookingHoldPerUnit: Number(settings.bookingHoldPricePerUnit),
    });
    return {
      blockedEndDate: availability.blockedEndDate,
      availability: { available: availability.isAvailable, conflicts: availability.unavailableItems },
      lines,
      totals: this.pricingService.calculateTotals(lines, 0),
      settingsSnapshot: {
        bookingHoldPricePerUnit: Number(settings.bookingHoldPricePerUnit),
        bookingBufferTimeMinutes: settings.bookingBufferTimeMinutes,
        maxRentalTimeDays: settings.maxRentalTimeDays,
        maxLateReturnTimeHours: settings.maxLateReturnTimeHours,
      },
      policyVersion: 'v1',
    };
  }

  private async findDetailOrThrow(id: string): Promise<RentalOrderDetailRecord> {
    const order = await this.prisma.rentalOrder.findFirst({ where: { id, deletedAt: null }, include: orderDetailInclude });
    if (!order) throw new NotFoundException(RENTAL_ORDER_NOT_FOUND);
    return order;
  }

  private async findActionableOrder(id: string) {
    const order = await this.prisma.rentalOrder.findFirst({ where: { id, deletedAt: null } });
    if (!order || order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DONE) throw new BadRequestException(INCORRECT_INPUT);
    return order;
  }

  private async findCustomerOrThrow(id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, deletedAt: null, status: CustomerStatus.ACTIVE } });
    if (!customer) throw new BadRequestException(RENTAL_ORDER_CUSTOMER_INVALID);
    return customer;
  }

  private async promoteToConfirmedIfReady(id: string, userId: string, tx: DbClient): Promise<void> {
    const order = await tx.rentalOrder.findUnique({ where: { id }, include: { lines: { include: { allocations: true } } } });
    if (!order || order.status !== OrderStatus.CREATED || Number(order.amountDueBeforeHandover) > 0) return;
    const allocated = order.lines.reduce(
      (total, line) => total + line.allocations.filter((allocation) => allocation.status !== RentalAllocationStatus.RELEASED).length,
      0,
    );
    const required = order.lines.reduce((total, line) => total + line.quantity, 0);
    if (allocated < required) return;
    assertRentalOrderTransition(order.status, OrderStatus.CONFIRMED);
    await tx.rentalOrder.update({ where: { id }, data: { status: OrderStatus.CONFIRMED, handoverStatus: HandoverStatus.READY, updatedBy: userId } });
    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        fromStatus: OrderStatus.CREATED,
        toStatus: OrderStatus.CONFIRMED,
        note: 'Payment obligation completed',
        createdBy: userId,
      },
    });
  }

  private async generateOrderCode(): Promise<string> {
    return `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 10_000)
      .toString()
      .padStart(4, '0')}`;
  }

  private sortField(sortBy?: RentalOrderSortBy): RentalOrderSortBy {
    return sortBy ?? RentalOrderSortBy.CREATED_AT;
  }

  private quoteRequestSnapshot(dto: CreateRentalQuoteDto) {
    return {
      customerId: dto.customerId,
      startDate: dto.startDate.toISOString(),
      endDate: dto.endDate.toISOString(),
      pickupMethod: dto.pickupMethod,
      deliveryAddress: dto.deliveryAddress,
      excludeOrderId: dto.excludeOrderId,
      items: dto.items,
    };
  }

  private parseQuoteRequest(snapshot: Prisma.JsonValue): CreateRentalQuoteDto {
    const value = snapshot as unknown as {
      customerId?: string;
      startDate: string;
      endDate: string;
      pickupMethod: 'PICKUP_AT_STORE' | 'DELIVERY';
      deliveryAddress?: string;
      excludeOrderId?: string;
      items: RentalOrderItemDto[];
    };
    return {
      customerId: value.customerId,
      startDate: new Date(value.startDate),
      endDate: new Date(value.endDate),
      pickupMethod: value.pickupMethod,
      deliveryAddress: value.deliveryAddress,
      excludeOrderId: value.excludeOrderId,
      items: value.items,
    };
  }

  private quoteLineOut(line: PreparedQuote['lines'][number]) {
    return { productId: line.product.id, productName: line.product.name, sku: line.product.sku, quantity: line.quantity, ...line.pricing };
  }

  private customerSnapshot(customer: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    identityNumber: string | null;
    socialContact: string | null;
  }) {
    return {
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      identityNumber: customer.identityNumber,
      socialContact: customer.socialContact,
    };
  }

  private customerSnapshotFromUpdate(snapshot: UpdateRentalOrderCustomerSnapshotDto): RentalOrderCustomerSnapshotValue {
    return {
      name: snapshot.name.trim(),
      phone: snapshot.phone?.trim() || null,
      email: snapshot.email?.trim() || null,
      address: snapshot.address?.trim() || null,
      identityNumber: snapshot.identityNumber?.trim() || null,
      socialContact: snapshot.socialContact.trim(),
    };
  }

  private customerSnapshotOut(snapshot: Prisma.JsonValue): RentalOrderOutDto['customerSnapshot'] {
    const value = snapshot as unknown as RentalOrderOutDto['customerSnapshot'];

    return {
      ...value,
      socialContact: value.socialContact ?? null,
    };
  }

  private toListOut(order: {
    id: string;
    code: string;
    source: OrderSource;
    pickupMethod: PickupMethod;
    status: OrderStatus;
    handoverStatus: HandoverStatus;
    returnStatus: ReturnStatus;
    settlementStatus: RentalSettlementStatus;
    customerSnapshot: Prisma.JsonValue;
    startDate: Date;
    endDate: Date;
    actualReturnDate: Date | null;
    rentalFeeTotal: Prisma.Decimal;
    deliveryFeeTotal: Prisma.Decimal;
    bookingHoldTotal: Prisma.Decimal;
    securityDepositTotal: Prisma.Decimal;
    totalCustomerObligation: Prisma.Decimal;
    paidTotal: Prisma.Decimal;
    amountDueBeforeHandover: Prisma.Decimal;
    refundDue: Prisma.Decimal;
    additionalChargeDue: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
  }): RentalOrderListItemOutDto {
    const overdue = getRentalOrderOverdue(order.endDate, order.status, order.actualReturnDate);
    return {
      ...order,
      customerSnapshot: this.customerSnapshotOut(order.customerSnapshot),
      rentalFeeTotal: Number(order.rentalFeeTotal),
      deliveryFeeTotal: Number(order.deliveryFeeTotal),
      bookingHoldTotal: Number(order.bookingHoldTotal),
      securityDepositTotal: Number(order.securityDepositTotal),
      totalCustomerObligation: Number(order.totalCustomerObligation),
      paidTotal: Number(order.paidTotal),
      amountDueBeforeHandover: Number(order.amountDueBeforeHandover),
      refundDue: Number(order.refundDue),
      additionalChargeDue: Number(order.additionalChargeDue),
      ...overdue,
    };
  }

  private toDetailOut(order: RentalOrderDetailRecord): RentalOrderOutDto {
    const overdue = getRentalOrderOverdue(order.endDate, order.status, order.actualReturnDate);
    const financials: RentalOrderFinancialsOutDto = {
      rentalFeeTotal: Number(order.rentalFeeTotal),
      deliveryFeeTotal: Number(order.deliveryFeeTotal),
      bookingHoldTotal: Number(order.bookingHoldTotal),
      securityDepositTotal: Number(order.securityDepositTotal),
      lateFeeTotal: Number(order.lateFeeTotal),
      damageCompensationTotal: Number(order.damageCompensationTotal),
      cancellationFeeTotal: Number(
        order.charges.filter((charge) => charge.kind === RentalChargeKind.CANCELLATION_FEE).reduce((sum, charge) => sum + Number(charge.amount), 0),
      ),
      totalCustomerObligation: Number(order.totalCustomerObligation),
      paidTotal: Number(order.paidTotal),
      amountDueAtBooking: Number(order.amountDueAtBooking),
      amountDueBeforeHandover: Number(order.amountDueBeforeHandover),
      refundDue: Number(order.refundDue),
      additionalChargeDue: Number(order.additionalChargeDue),
      actualRefundTotal: Number(order.actualRefundTotal),
    };
    return {
      id: order.id,
      code: order.code,
      source: order.source,
      status: order.status,
      handoverStatus: order.handoverStatus,
      returnStatus: order.returnStatus,
      settlementStatus: order.settlementStatus,
      ...overdue,
      customerId: order.customerId,
      customerSnapshot: this.customerSnapshotOut(order.customerSnapshot),
      settingsSnapshot: order.settingsSnapshot,
      rentalPeriod: {
        startDate: order.startDate,
        endDate: order.endDate,
        actualPickupDate: order.actualPickupDate,
        actualReturnDate: order.actualReturnDate,
      },
      fulfillment: { pickupMethod: order.pickupMethod, deliveryAddress: order.deliveryAddress },
      financials,
      notes: { customerNote: order.note, internalNote: order.internalNote, cancelReason: order.cancelReason },
      lines: order.lines.map((line) => this.toLineOut(line)),
      charges: order.charges.map((charge) => this.toChargeOut(charge)),
      payments: order.paymentTransactions.map((payment) => this.toPaymentOut(payment)),
      refunds: order.refunds.map((refund) => this.toRefundOut(refund)),
      inspections: order.inspections.map((inspection) => ({
        id: inspection.id,
        type: inspection.type,
        inspectedAt: inspection.inspectedAt,
        note: inspection.note,
        items: inspection.items.map((item) => ({
          allocationId: item.allocationId,
          condition: item.condition,
          note: item.note,
          accessories: item.accessories,
        })),
      })),
      statusHistories: order.statusHistories,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      deletedAt: order.deletedAt,
    };
  }

  private toLineOut(line: RentalOrderDetailRecord['lines'][number]): RentalOrderLineOutDto {
    return {
      id: line.id,
      productId: line.productId,
      productName: line.product.name,
      sku: line.product.sku,
      assetUnitCount: line.product._count.assetUnits,
      quantity: line.quantity,
      unitRentalFee: Number(line.unitRentalFee),
      unitDepositAmount: Number(line.unitDepositAmount),
      unitBookingHoldAmount: Number(line.unitBookingHoldAmount),
      lineRentalTotal: Number(line.lineRentalTotal),
      lineDepositTotal: Number(line.lineDepositTotal),
      lineBookingHoldTotal: Number(line.lineBookingHoldTotal),
      accessoriesSnapshot: line.accessoriesSnapshot,
      note: line.note,
      allocations: line.allocations.map((allocation) => ({
        id: allocation.id,
        assetUnitId: allocation.assetUnitId,
        serialNumber: allocation.assetUnit.serialNumber,
        source: allocation.source,
        status: allocation.status,
        startDate: allocation.startDate,
        endDate: allocation.endDate,
        blockedEndDate: allocation.blockedEndDate,
      })),
    };
  }

  private toChargeOut(charge: RentalOrderDetailRecord['charges'][number]): RentalOrderChargeOutDto {
    return {
      id: charge.id,
      kind: charge.kind,
      amount: Number(charge.amount),
      status: charge.status,
      refundable: charge.refundable,
      metadata: charge.metadata,
    };
  }

  private toPaymentOut(payment: RentalOrderDetailRecord['paymentTransactions'][number]): RentalOrderPaymentOutDto {
    return {
      id: payment.id,
      direction: payment.direction,
      amount: Number(payment.amount),
      method: payment.method,
      status: payment.status,
      referenceCode: payment.referenceCode,
      idempotencyKey: payment.idempotencyKey,
      createdAt: payment.createdAt,
    };
  }

  private toRefundOut(refund: RentalOrderDetailRecord['refunds'][number]): RentalOrderRefundOutDto {
    return {
      id: refund.id,
      amount: Number(refund.amount),
      status: refund.status,
      method: refund.method,
      referenceCode: refund.referenceCode,
      createdAt: refund.createdAt,
    };
  }

  private jsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}
