import { EAvailabilityChangeReason } from '@/libs/enums/socket.enum';
import { RENTAL_ORDER_HANDOVER_PAYMENT_INSUFFICIENT } from '@/libs/constants/error.constants';
import { Prisma } from '@generated/prisma/client';
import { CollateralType, OrderStatus, PaymentKind, PaymentRecordStatus, PaymentStatus, RefundStatus, RentalOrderItemStatus } from '@generated/prisma/enums';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CancelRentalOrderDto,
  CompleteRentalOrderDto,
  HandoverRentalOrderDto,
  ReturnRentalOrderDto,
  StartRentalOrderDto,
} from '../dto/rental-order-actions.dto';
import { RentalOrderOutDto } from '../dto/rental-order-out.dto';
import { RentalOrdersService } from '../rental-orders.service';
import { BLOCKING_ORDER_STATUSES } from './rental-order-availability.service';
import { RentalOrderAvailabilityService } from './rental-order-availability.service';
import { RentalOrderEventsService } from './rental-order-events.service';
import { RentalOrderLogAction, RentalOrderLogsService } from './rental-order-logs.service';
import { RentalOrderRealtimeService } from './rental-order-realtime.service';

const CANCELABLE_STATUSES = [OrderStatus.CREATED, OrderStatus.CONFIRMED];
const HANDOVER_STATUSES = [OrderStatus.CREATED, OrderStatus.CONFIRMED];
const COMPLETE_STATUSES = [OrderStatus.RENTING, OrderStatus.OVERDUE, OrderStatus.RETURNED];

@Injectable()
export class RentalOrderWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rentalOrdersService: RentalOrdersService,
    private readonly availabilityService: RentalOrderAvailabilityService,
    private readonly eventsService: RentalOrderEventsService,
    private readonly realtimeService: RentalOrderRealtimeService,
    private readonly logsService: RentalOrderLogsService,
  ) {}

  async cancelOrder(id: string, dto: CancelRentalOrderDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    let shouldEmitAvailabilityChanged = false;
    const order = await this.prisma.$transaction(async (tx) => {
      await this.rentalOrdersService.acquireAdvisoryLocks(tx, [`rental-order:${id}`]);
      const existingOrder = await this.rentalOrdersService.findExistingRentalOrderByIdInTransaction(tx, id);
      this.rentalOrdersService.assertStatusIn(existingOrder.status, CANCELABLE_STATUSES);

      const refundAmount = this.resolveCancelRefundAmount(existingOrder, dto);

      await this.eventsService.appendStatusChange(tx, {
        orderId: id,
        fromStatus: existingOrder.status,
        toStatus: OrderStatus.CANCELLED,
        createdBy: currentUser.id,
        note: dto.note ?? dto.cancelReason,
      });

      await tx.rentalOrderItem.updateMany({
        where: {
          orderId: id,
          status: {
            in: [RentalOrderItemStatus.PENDING, RentalOrderItemStatus.ACTIVE],
          },
          deletedAt: null,
        },
        data: {
          status: RentalOrderItemStatus.CANCELLED,
          updatedBy: currentUser.id,
        },
      });

      if (refundAmount > 0) {
        await tx.paymentRecord.create({
          data: {
            orderId: id,
            kind: PaymentKind.REFUND,
            method: 'OTHER',
            status: PaymentRecordStatus.SUCCESS,
            amount: refundAmount,
            note: dto.note ?? 'Refund on order cancellation',
            createdBy: currentUser.id,
          },
        });
      }

      const refundStatus = refundAmount <= 0 ? existingOrder.refundStatus : refundAmount >= Number(existingOrder.paidTotal) ? RefundStatus.REFUNDED : RefundStatus.PARTIALLY_REFUNDED;
      shouldEmitAvailabilityChanged = BLOCKING_ORDER_STATUSES.includes(existingOrder.status);

      const order = await tx.rentalOrder.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
          refundStatus,
          estimatedRefundTotal: 0,
          actualRefundTotal: Number(existingOrder.actualRefundTotal) + refundAmount,
          cancelReason: dto.cancelReason,
          updatedBy: currentUser.id,
          searchText: this.rentalOrdersService.buildOrderSearchText({
            code: existingOrder.code,
            customer: existingOrder.customer,
            deliveryAddress: existingOrder.deliveryAddress,
            note: existingOrder.note,
            internalNote: existingOrder.internalNote,
            cancelReason: dto.cancelReason,
          }),
        },
        include: this.rentalOrdersService.rentalOrderInclude(),
      });

      await this.logsService.appendLog(tx, {
        orderId: id,
        actor: currentUser,
        action: RentalOrderLogAction.CancelOrder,
        changes: this.logsService.diffFields([
          { field: 'status', label: 'Trạng thái đơn', oldValue: existingOrder.status, newValue: order.status },
          { field: 'notes.cancelReason', label: 'Lý do hủy', oldValue: existingOrder.cancelReason, newValue: order.cancelReason },
          { field: 'refundStatus', label: 'Trạng thái hoàn tiền', oldValue: existingOrder.refundStatus, newValue: order.refundStatus },
          { field: 'financials.estimatedRefundTotal', label: 'Còn phải hoàn', oldValue: existingOrder.estimatedRefundTotal, newValue: order.estimatedRefundTotal },
          { field: 'financials.actualRefundTotal', label: 'Đã hoàn', oldValue: existingOrder.actualRefundTotal, newValue: order.actualRefundTotal },
        ]),
        note: dto.note ?? dto.cancelReason,
      });

      return tx.rentalOrder.findFirstOrThrow({
        where: { id },
        include: this.rentalOrdersService.rentalOrderInclude(),
      });
    });

    if (shouldEmitAvailabilityChanged) {
      this.realtimeService.emitAvailabilityChanged(EAvailabilityChangeReason.ORDER_CANCELLED, order.items);
    }

    return this.rentalOrdersService.toRentalOrderOut(order);
  }

  async handoverOrder(id: string, dto: HandoverRentalOrderDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    let shouldEmitAvailabilityChanged = false;
    const order = await this.prisma.$transaction(async (tx) => {
      await this.rentalOrdersService.acquireAdvisoryLocks(tx, [`rental-order:${id}`]);
      const existingOrder = await this.rentalOrdersService.findExistingRentalOrderByIdInTransaction(tx, id);
      this.rentalOrdersService.assertStatusIn(existingOrder.status, HANDOVER_STATUSES);

      await this.rentalOrdersService.acquireAdvisoryLocks(tx, [
        ...[...new Set(existingOrder.items.map((item) => item.productId))].map((productId) => `rental-product:${productId}`),
        ...existingOrder.items.map((item) => `rental-asset:${item.assetUnitId}`),
      ]);

      const availability = await this.availabilityService.evaluateAvailability({
        startDate: existingOrder.startDate,
        endDate: existingOrder.endDate,
        items: this.rentalOrdersService.normalizeExistingItems(existingOrder.items),
        excludeOrderId: existingOrder.id,
      });
      this.rentalOrdersService.assertAvailable(availability);

      const collateralType = dto.collateralType ?? CollateralType.NONE;
      const handoverTotals = this.calculateHandoverTotals({
        depositTotal: Number(existingOrder.depositTotal),
        chargeTotal: Number(existingOrder.chargeTotal),
        paidTotalBeforeHandover: Number(existingOrder.paidTotal),
        paymentAmount: dto.payment?.amount ?? 0,
        collateralType,
      });

      if (dto.payment && dto.payment.amount > 0) {
        await tx.paymentRecord.create({
          data: {
            orderId: id,
            kind: PaymentKind.HANDOVER_PAYMENT,
            method: dto.payment.method,
            status: PaymentRecordStatus.SUCCESS,
            amount: dto.payment.amount,
            referenceCode: dto.payment.referenceCode,
            note: dto.payment.note,
            createdBy: currentUser.id,
          },
        });
      }

      const paidTotal = await this.getSuccessfulPaidTotal(tx, id);
      if (paidTotal < handoverTotals.handoverRequiredTotal) {
        throw new BadRequestException({
          ...RENTAL_ORDER_HANDOVER_PAYMENT_INSUFFICIENT,
          meta: {
            collateralType,
            adjustedDepositTotal: handoverTotals.adjustedDepositTotal,
            handoverRequiredTotal: handoverTotals.handoverRequiredTotal,
            paidTotal,
            handoverAmountDue: Math.max(handoverTotals.handoverRequiredTotal - paidTotal, 0),
          },
        });
      }

      await this.eventsService.appendStatusChange(tx, {
        orderId: id,
        fromStatus: existingOrder.status,
        toStatus: OrderStatus.RENTING,
        createdBy: currentUser.id,
        note: dto.note,
      });

      await tx.rentalOrderItem.updateMany({
        where: {
          orderId: id,
          status: {
            in: [RentalOrderItemStatus.PENDING, RentalOrderItemStatus.ACTIVE],
          },
          deletedAt: null,
        },
        data: {
          status: RentalOrderItemStatus.ACTIVE,
          updatedBy: currentUser.id,
        },
      });

      shouldEmitAvailabilityChanged = true;

      const order = await tx.rentalOrder.update({
        where: { id },
        data: {
          status: OrderStatus.RENTING,
          actualPickupDate: dto.actualPickupDate ?? new Date(),
          collateralType,
          collateralDescription: dto.collateralDescription,
          paidTotal,
          adjustedDepositTotal: handoverTotals.adjustedDepositTotal,
          handoverRequiredTotal: handoverTotals.handoverRequiredTotal,
          handoverAmountDue: 0,
          paymentStatus: this.resolvePaymentStatus(paidTotal, handoverTotals.handoverRequiredTotal),
          updatedBy: currentUser.id,
        },
        include: this.rentalOrdersService.rentalOrderInclude(),
      });

      await this.logsService.appendLog(tx, {
        orderId: id,
        actor: currentUser,
        action: RentalOrderLogAction.HandoverOrder,
        changes: this.logsService.diffFields([
          { field: 'status', label: 'Trạng thái đơn', oldValue: existingOrder.status, newValue: order.status },
          { field: 'rentalPeriod.actualPickupDate', label: 'Giờ bàn giao', oldValue: existingOrder.actualPickupDate, newValue: order.actualPickupDate },
          { field: 'fulfillment.collateralType', label: 'Loại thế chấp', oldValue: existingOrder.collateralType, newValue: order.collateralType },
          {
            field: 'fulfillment.collateralDescription',
            label: 'Mô tả thế chấp',
            oldValue: existingOrder.collateralDescription,
            newValue: order.collateralDescription,
          },
          { field: 'financials.paidTotal', label: 'Đã thu', oldValue: existingOrder.paidTotal, newValue: order.paidTotal },
          {
            field: 'financials.adjustedDepositTotal',
            label: 'Tiền cọc áp dụng',
            oldValue: existingOrder.adjustedDepositTotal,
            newValue: order.adjustedDepositTotal,
          },
          {
            field: 'financials.handoverRequiredTotal',
            label: 'Tổng cần thu khi bàn giao',
            oldValue: existingOrder.handoverRequiredTotal,
            newValue: order.handoverRequiredTotal,
          },
          { field: 'paymentStatus', label: 'Trạng thái thanh toán', oldValue: existingOrder.paymentStatus, newValue: order.paymentStatus },
        ]),
        note: dto.note,
      });

      return tx.rentalOrder.findFirstOrThrow({
        where: { id },
        include: this.rentalOrdersService.rentalOrderInclude(),
      });
    });

    if (shouldEmitAvailabilityChanged) {
      this.realtimeService.emitAvailabilityChanged(EAvailabilityChangeReason.ORDER_UPDATED, order.items);
    }

    return this.rentalOrdersService.toRentalOrderOut(order);
  }

  async markRenting(id: string, dto: StartRentalOrderDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    return this.handoverOrder(id, dto, currentUser);
  }

  async markReturned(id: string, dto: ReturnRentalOrderDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    return this.completeOrder(id, { actualReturnDate: dto.actualReturnDate, note: dto.note }, currentUser);
  }

  async completeOrder(id: string, dto: CompleteRentalOrderDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    const order = await this.prisma.$transaction(async (tx) => {
      await this.rentalOrdersService.acquireAdvisoryLocks(tx, [`rental-order:${id}`]);
      const existingOrder = await this.rentalOrdersService.findExistingRentalOrderByIdInTransaction(tx, id);
      this.rentalOrdersService.assertStatusIn(existingOrder.status, COMPLETE_STATUSES);

      const actualReturnDate = dto.actualReturnDate ?? new Date();
      const lateFeeTotal = this.calculateLateFeeTotal(existingOrder, actualReturnDate);
      const damageFeeTotal = dto.damageFeeTotal ?? Number(existingOrder.damageFeeTotal);
      const compensationFeeTotal = Number(existingOrder.compensationFeeTotal);
      const chargeTotal = Math.max(
        Number(existingOrder.rentalFeeTotal) +
          Number(existingOrder.deliveryFeeTotal) +
          lateFeeTotal +
          damageFeeTotal +
          compensationFeeTotal -
          Number(existingOrder.discountTotal),
        0,
      );

      if (dto.settlementPayment && dto.settlementPayment.amount > 0) {
        await tx.paymentRecord.create({
          data: {
            orderId: id,
            kind: dto.settlementPayment.kind,
            method: dto.settlementPayment.method,
            status: PaymentRecordStatus.SUCCESS,
            amount: dto.settlementPayment.amount,
            referenceCode: dto.settlementPayment.referenceCode,
            note: dto.settlementPayment.note,
            createdBy: currentUser.id,
          },
        });
      }

      const paidTotal = await this.getSuccessfulPaidTotal(tx, id);
      const actualRefundTotal = await this.getSuccessfulRefundTotal(tx, id);
      const estimatedRefundTotal = Math.max(paidTotal - chargeTotal - actualRefundTotal, 0);
      const refundStatus = actualRefundTotal <= 0 ? (estimatedRefundTotal > 0 ? RefundStatus.NOT_REQUIRED : existingOrder.refundStatus) : estimatedRefundTotal <= 0 ? RefundStatus.REFUNDED : RefundStatus.PARTIALLY_REFUNDED;

      await this.eventsService.appendStatusChange(tx, {
        orderId: id,
        fromStatus: existingOrder.status,
        toStatus: OrderStatus.DONE,
        createdBy: currentUser.id,
        note: dto.note ?? dto.damageNote,
      });

      await tx.rentalOrderItem.updateMany({
        where: {
          orderId: id,
          status: RentalOrderItemStatus.ACTIVE,
          deletedAt: null,
        },
        data: {
          status: RentalOrderItemStatus.RETURNED,
          updatedBy: currentUser.id,
        },
      });

      const order = await tx.rentalOrder.update({
        where: { id },
        data: {
          status: OrderStatus.DONE,
          actualReturnDate,
          lateFeeTotal,
          damageFeeTotal,
          chargeTotal,
          paidTotal,
          estimatedRefundTotal,
          actualRefundTotal,
          refundStatus,
          paymentStatus: this.resolvePaymentStatus(paidTotal, chargeTotal),
          updatedBy: currentUser.id,
        },
        include: this.rentalOrdersService.rentalOrderInclude(),
      });

      await this.logsService.appendLog(tx, {
        orderId: id,
        actor: currentUser,
        action: RentalOrderLogAction.CompleteOrder,
        changes: this.logsService.diffFields([
          { field: 'status', label: 'Trạng thái đơn', oldValue: existingOrder.status, newValue: order.status },
          { field: 'rentalPeriod.actualReturnDate', label: 'Giờ trả thực tế', oldValue: existingOrder.actualReturnDate, newValue: order.actualReturnDate },
          { field: 'financials.lateFeeTotal', label: 'Phí trễ hạn', oldValue: existingOrder.lateFeeTotal, newValue: order.lateFeeTotal },
          { field: 'financials.damageFeeTotal', label: 'Phí hư hỏng', oldValue: existingOrder.damageFeeTotal, newValue: order.damageFeeTotal },
          { field: 'financials.chargeTotal', label: 'Tiền thuê cần thanh toán', oldValue: existingOrder.chargeTotal, newValue: order.chargeTotal },
          { field: 'financials.paidTotal', label: 'Đã thu', oldValue: existingOrder.paidTotal, newValue: order.paidTotal },
          {
            field: 'financials.estimatedRefundTotal',
            label: 'Còn phải hoàn',
            oldValue: existingOrder.estimatedRefundTotal,
            newValue: order.estimatedRefundTotal,
          },
          { field: 'financials.actualRefundTotal', label: 'Đã hoàn', oldValue: existingOrder.actualRefundTotal, newValue: order.actualRefundTotal },
          { field: 'refundStatus', label: 'Trạng thái hoàn tiền', oldValue: existingOrder.refundStatus, newValue: order.refundStatus },
          { field: 'paymentStatus', label: 'Trạng thái thanh toán', oldValue: existingOrder.paymentStatus, newValue: order.paymentStatus },
        ]),
        note: dto.note ?? dto.damageNote,
      });

      return tx.rentalOrder.findFirstOrThrow({
        where: { id },
        include: this.rentalOrdersService.rentalOrderInclude(),
      });
    });

    this.realtimeService.emitAvailabilityChanged(EAvailabilityChangeReason.ORDER_UPDATED, order.items);
    return this.rentalOrdersService.toRentalOrderOut(order);
  }

  private resolveCancelRefundAmount(
    order: Awaited<ReturnType<RentalOrdersService['findExistingRentalOrderByIdInTransaction']>>,
    dto: CancelRentalOrderDto,
  ): number {
    if (dto.keepPaidAmountAsPenalty) return 0;
    if (typeof dto.refundAmount === 'number') return Math.min(dto.refundAmount, Number(order.paidTotal));
    if (dto.refundBookingHold) return Math.min(Number(order.paidTotal), Number(order.bookingHoldTotal));

    return 0;
  }

  private calculateHandoverTotals({
    depositTotal,
    chargeTotal,
    paidTotalBeforeHandover,
    paymentAmount,
    collateralType,
  }: {
    depositTotal: number;
    chargeTotal: number;
    paidTotalBeforeHandover: number;
    paymentAmount: number;
    collateralType: CollateralType;
  }) {
    const rentalCharge = Math.max(chargeTotal, 0);
    let adjustedDepositTotal = Math.max(depositTotal, 0);

    if (adjustedDepositTotal <= 0 && rentalCharge > 0) {
      adjustedDepositTotal = rentalCharge * 2;
    }

    while (adjustedDepositTotal / 2 < rentalCharge) {
      adjustedDepositTotal *= 2;
    }

    const handoverRequiredTotal =
      collateralType === CollateralType.VEHICLE_OR_HIGH_VALUE
        ? rentalCharge
        : collateralType === CollateralType.IDENTITY_CARD || collateralType === CollateralType.OTHER_ASSET
          ? (adjustedDepositTotal + rentalCharge) / 2
          : adjustedDepositTotal;
    const paidTotal = Math.max(paidTotalBeforeHandover, 0) + Math.max(paymentAmount, 0);

    return {
      adjustedDepositTotal: Math.round(adjustedDepositTotal),
      handoverRequiredTotal: Math.round(handoverRequiredTotal),
      handoverAmountDue: Math.max(Math.round(handoverRequiredTotal) - paidTotal, 0),
    };
  }

  private calculateLateFeeTotal(
    order: Awaited<ReturnType<RentalOrdersService['findExistingRentalOrderByIdInTransaction']>>,
    actualReturnDate: Date,
  ): number {
    const settingsSnapshot = this.isRecord(order.settingsSnapshot) ? order.settingsSnapshot : {};
    const maxLateReturnTimeHours = Number(settingsSnapshot.maxLateReturnTimeHours ?? 0);
    const lateHours = Math.max((actualReturnDate.getTime() - order.endDate.getTime()) / (60 * 60 * 1000) - maxLateReturnTimeHours, 0);

    if (lateHours <= 0) return 0;

    return Math.round(
      order.items
        .filter((item) => item.deletedAt === null && item.status === RentalOrderItemStatus.ACTIVE)
        .reduce((total, item) => total + this.getHourlyOveragePrice(item.snapshot) * lateHours, 0),
    );
  }

  private getHourlyOveragePrice(snapshot: Prisma.JsonValue): number {
    if (!this.isRecord(snapshot) || !this.isRecord(snapshot.product)) return 0;

    const value = snapshot.product.hourlyOveragePrice;
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;

    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async getSuccessfulPaidTotal(tx: Prisma.TransactionClient, orderId: string): Promise<number> {
    const result = await tx.paymentRecord.aggregate({
      where: {
        orderId,
        status: PaymentRecordStatus.SUCCESS,
        kind: {
          not: PaymentKind.REFUND,
        },
        deletedAt: null,
      },
      _sum: {
        amount: true,
      },
    });

    return Number(result._sum.amount ?? 0);
  }

  private async getSuccessfulRefundTotal(tx: Prisma.TransactionClient, orderId: string): Promise<number> {
    const result = await tx.paymentRecord.aggregate({
      where: {
        orderId,
        status: PaymentRecordStatus.SUCCESS,
        kind: PaymentKind.REFUND,
        deletedAt: null,
      },
      _sum: {
        amount: true,
      },
    });

    return Number(result._sum.amount ?? 0);
  }

  private resolvePaymentStatus(paidTotal: number, chargeTotal: number): PaymentStatus {
    if (paidTotal <= 0) return PaymentStatus.UNPAID;
    return paidTotal >= chargeTotal ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
