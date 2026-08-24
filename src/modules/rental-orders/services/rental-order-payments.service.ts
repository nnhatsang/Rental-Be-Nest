import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentKind, PaymentRecordStatus, PaymentStatus, RefundStatus, RentalOrderItemStatus } from '@generated/prisma/enums';
import { Prisma } from '@generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EAvailabilityChangeReason } from '@/libs/enums/socket.enum';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { RentalOrderOutDto } from '../dto/rental-order-out.dto';
import { RecordRentalOrderPaymentDto, RefundRentalOrderPaymentDto, RentalOrderNoteDto } from '../dto/rental-order-actions.dto';
import { RentalOrderAvailabilityService } from './rental-order-availability.service';
import { RentalOrderLogAction, RentalOrderLogsService } from './rental-order-logs.service';
import { RentalOrderRealtimeService } from './rental-order-realtime.service';
import { RentalOrdersService } from '../rental-orders.service';

@Injectable()
export class RentalOrderPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rentalOrdersService: RentalOrdersService,
    private readonly availabilityService: RentalOrderAvailabilityService,
    private readonly realtimeService: RentalOrderRealtimeService,
    private readonly logsService: RentalOrderLogsService,
  ) {}

  async recordPayment(id: string, dto: RecordRentalOrderPaymentDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    let shouldEmitAvailabilityChanged = false;
    const order = await this.prisma.$transaction(async (tx) => {
      await this.rentalOrdersService.acquireAdvisoryLocks(tx, [`rental-order:${id}`]);
      const existingOrder = await this.rentalOrdersService.findExistingRentalOrderByIdInTransaction(tx, id);
      const paymentStatus = dto.status ?? PaymentRecordStatus.SUCCESS;

      const payment = await tx.paymentRecord.create({
        data: {
          orderId: id,
          kind: dto.kind,
          method: dto.method,
          status: paymentStatus,
          amount: dto.amount,
          referenceCode: dto.referenceCode,
          note: dto.note,
          createdBy: currentUser.id,
        },
      });

      if (paymentStatus === PaymentRecordStatus.SUCCESS) {
        const result = await this.applySuccessfulPayment(tx, existingOrder, payment.id, currentUser.id, dto.note);
        shouldEmitAvailabilityChanged = result.shouldEmitAvailabilityChanged;
        await this.logsService.appendLog(tx, {
          orderId: id,
          actor: currentUser,
          action: RentalOrderLogAction.RecordPayment,
          changes: this.logsService.diffFields([
            { field: 'payment.kind', label: 'Loại thanh toán', oldValue: null, newValue: payment.kind },
            { field: 'payment.method', label: 'Phương thức', oldValue: null, newValue: payment.method },
            { field: 'payment.status', label: 'Trạng thái phiếu thu', oldValue: null, newValue: payment.status },
            { field: 'payment.amount', label: 'Số tiền', oldValue: null, newValue: payment.amount },
            { field: 'payment.referenceCode', label: 'Mã tham chiếu', oldValue: null, newValue: payment.referenceCode },
            { field: 'financials.paidTotal', label: 'Đã thu', oldValue: existingOrder.paidTotal, newValue: result.order.paidTotal },
            { field: 'paymentStatus', label: 'Trạng thái thanh toán', oldValue: existingOrder.paymentStatus, newValue: result.order.paymentStatus },
            { field: 'status', label: 'Trạng thái đơn', oldValue: existingOrder.status, newValue: result.order.status },
          ]),
          note: dto.note,
        });

        return tx.rentalOrder.findFirstOrThrow({
          where: { id },
          include: this.rentalOrdersService.rentalOrderInclude(),
        });
      }

      const order = await tx.rentalOrder.findFirstOrThrow({
        where: { id },
        include: this.rentalOrdersService.rentalOrderInclude(),
      });

      await this.logsService.appendLog(tx, {
        orderId: id,
        actor: currentUser,
        action: RentalOrderLogAction.RecordPayment,
        changes: [
          { field: 'payment.kind', label: 'Loại thanh toán', oldValue: null, newValue: payment.kind },
          { field: 'payment.method', label: 'Phương thức', oldValue: null, newValue: payment.method },
          { field: 'payment.status', label: 'Trạng thái phiếu thu', oldValue: null, newValue: payment.status },
          { field: 'payment.amount', label: 'Số tiền', oldValue: null, newValue: payment.amount },
          { field: 'payment.referenceCode', label: 'Mã tham chiếu', oldValue: null, newValue: payment.referenceCode },
        ],
        note: dto.note,
      });

      return tx.rentalOrder.findFirstOrThrow({
        where: { id },
        include: this.rentalOrdersService.rentalOrderInclude(),
      });
    });

    if (shouldEmitAvailabilityChanged) {
      this.realtimeService.emitAvailabilityChanged(EAvailabilityChangeReason.ORDER_CONFIRMED, order.items);
    }

    return this.rentalOrdersService.toRentalOrderOut(order);
  }

  async confirmPayment(id: string, paymentId: string, dto: RentalOrderNoteDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    let shouldEmitAvailabilityChanged = false;
    const order = await this.prisma.$transaction(async (tx) => {
      await this.rentalOrdersService.acquireAdvisoryLocks(tx, [`rental-order:${id}`]);
      const existingOrder = await this.rentalOrdersService.findExistingRentalOrderByIdInTransaction(tx, id);
      const payment = await tx.paymentRecord.findFirst({
        where: {
          id: paymentId,
          orderId: id,
          deletedAt: null,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found');
      }

      if (payment.status !== PaymentRecordStatus.PENDING) {
        throw new BadRequestException('Only pending payments can be confirmed');
      }

      await tx.paymentRecord.update({
        where: { id: payment.id },
        data: {
          status: PaymentRecordStatus.SUCCESS,
          updatedBy: currentUser.id,
          note: dto.note ?? payment.note,
        },
      });

      const result = await this.applySuccessfulPayment(tx, existingOrder, payment.id, currentUser.id, dto.note);
      shouldEmitAvailabilityChanged = result.shouldEmitAvailabilityChanged;

      return result.order;
    });

    if (shouldEmitAvailabilityChanged) {
      this.realtimeService.emitAvailabilityChanged(EAvailabilityChangeReason.ORDER_CONFIRMED, order.items);
    }

    return this.rentalOrdersService.toRentalOrderOut(order);
  }

  async rejectPayment(id: string, paymentId: string, dto: RentalOrderNoteDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    const order = await this.prisma.$transaction(async (tx) => {
      await this.rentalOrdersService.acquireAdvisoryLocks(tx, [`rental-order:${id}`]);
      await this.rentalOrdersService.findExistingRentalOrderByIdInTransaction(tx, id);
      const payment = await tx.paymentRecord.findFirst({
        where: {
          id: paymentId,
          orderId: id,
          deletedAt: null,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found');
      }

      if (payment.status !== PaymentRecordStatus.PENDING) {
        throw new BadRequestException('Only pending payments can be rejected');
      }

      await tx.paymentRecord.update({
        where: { id: payment.id },
        data: {
          status: PaymentRecordStatus.FAILED,
          updatedBy: currentUser.id,
          note: dto.note ?? payment.note,
        },
      });

      return tx.rentalOrder.findFirstOrThrow({
        where: { id },
        include: this.rentalOrdersService.rentalOrderInclude(),
      });
    });

    return this.rentalOrdersService.toRentalOrderOut(order);
  }

  async recordRefund(id: string, dto: RefundRentalOrderPaymentDto, currentUser: AuthUser): Promise<RentalOrderOutDto> {
    const order = await this.prisma.$transaction(async (tx) => {
      await this.rentalOrdersService.acquireAdvisoryLocks(tx, [`rental-order:${id}`]);
      const existingOrder = await this.rentalOrdersService.findExistingRentalOrderByIdInTransaction(tx, id);
      const refundRecordStatus = dto.status ?? PaymentRecordStatus.SUCCESS;
      const existingBreakdown = this.rentalOrdersService.calculateFinancialBreakdown(existingOrder);

      if (refundRecordStatus === PaymentRecordStatus.SUCCESS && dto.amount > existingBreakdown.refundDue) {
        throw new BadRequestException(`So tien hoan khong duoc vuot qua ${existingBreakdown.refundDue}`);
      }

      await tx.paymentRecord.create({
        data: {
          orderId: id,
          kind: PaymentKind.REFUND,
          method: dto.method,
          status: refundRecordStatus,
          amount: dto.amount,
          referenceCode: dto.referenceCode,
          note: dto.note,
          createdBy: currentUser.id,
        },
      });

      const nextEstimatedRefundTotal =
        refundRecordStatus === PaymentRecordStatus.SUCCESS
          ? Math.max(existingBreakdown.refundDue - dto.amount, 0)
          : Number(existingOrder.estimatedRefundTotal);
      const nextActualRefundTotal =
        refundRecordStatus === PaymentRecordStatus.SUCCESS
          ? Number(existingOrder.actualRefundTotal) + dto.amount
          : Number(existingOrder.actualRefundTotal);
      const refundStatus =
        refundRecordStatus === PaymentRecordStatus.SUCCESS
          ? nextEstimatedRefundTotal <= 0
            ? RefundStatus.REFUNDED
            : RefundStatus.PARTIALLY_REFUNDED
          : existingOrder.refundStatus;

      const order = await tx.rentalOrder.update({
        where: { id },
        data: {
          estimatedRefundTotal: nextEstimatedRefundTotal,
          actualRefundTotal: nextActualRefundTotal,
          refundStatus,
        },
        include: this.rentalOrdersService.rentalOrderInclude(),
      });

      await this.logsService.appendLog(tx, {
        orderId: id,
        actor: currentUser,
        action: RentalOrderLogAction.RefundOrder,
        changes: this.logsService.diffFields([
          { field: 'refund.method', label: 'Phương thức hoàn', oldValue: null, newValue: dto.method },
          { field: 'refund.status', label: 'Trạng thái phiếu hoàn', oldValue: null, newValue: refundRecordStatus },
          { field: 'refund.amount', label: 'Số tiền hoàn', oldValue: null, newValue: dto.amount },
          { field: 'refund.referenceCode', label: 'Mã tham chiếu', oldValue: null, newValue: dto.referenceCode },
          {
            field: 'financials.estimatedRefundTotal',
            label: 'Còn phải hoàn',
            oldValue: existingOrder.estimatedRefundTotal,
            newValue: order.estimatedRefundTotal,
          },
          { field: 'financials.actualRefundTotal', label: 'Đã hoàn', oldValue: existingOrder.actualRefundTotal, newValue: order.actualRefundTotal },
          { field: 'refundStatus', label: 'Trạng thái hoàn tiền', oldValue: existingOrder.refundStatus, newValue: order.refundStatus },
        ]),
        note: dto.note,
      });

      return tx.rentalOrder.findFirstOrThrow({
        where: { id },
        include: this.rentalOrdersService.rentalOrderInclude(),
      });
    });

    return this.rentalOrdersService.toRentalOrderOut(order);
  }

  private async applySuccessfulPayment(
    tx: Prisma.TransactionClient,
    existingOrder: Awaited<ReturnType<RentalOrdersService['findExistingRentalOrderByIdInTransaction']>>,
    paymentId: string,
    currentUserId: string,
    note?: string | null,
  ): Promise<{
    order: Awaited<ReturnType<RentalOrdersService['findExistingRentalOrderByIdInTransaction']>>;
    shouldEmitAvailabilityChanged: boolean;
  }> {
    const paidTotal = await this.getSuccessfulPaidTotal(tx, existingOrder.id);
    const payableTotal =
      existingOrder.status === OrderStatus.CREATED
        ? Number(existingOrder.bookingHoldTotal)
        : (existingOrder.status === OrderStatus.CONFIRMED ||
              existingOrder.status === OrderStatus.RENTING) &&
            Number(existingOrder.handoverRequiredTotal) > 0
          ? Number(existingOrder.handoverRequiredTotal)
          : Number(existingOrder.chargeTotal);
    const paymentStatus = this.resolvePaymentStatus(paidTotal, payableTotal);
    const payment = await tx.paymentRecord.findUniqueOrThrow({
      where: {
        id: paymentId,
      },
    });

    let nextStatus = existingOrder.status;
    let shouldEmitAvailabilityChanged = false;

    if (
      existingOrder.status === OrderStatus.CREATED &&
      (payment.kind === PaymentKind.BOOKING_HOLD || paidTotal >= Number(existingOrder.bookingHoldTotal))
    ) {
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

      await this.rentalOrdersService.transitionOrderStatusInTransaction(tx, {
        order: existingOrder,
        nextStatus: OrderStatus.CONFIRMED,
        currentUserId,
        note: note ?? 'Payment confirmed and schedule reserved',
      });

      await tx.rentalOrderItem.updateMany({
        where: {
          orderId: existingOrder.id,
          status: RentalOrderItemStatus.PENDING,
          deletedAt: null,
        },
        data: {
          status: RentalOrderItemStatus.ACTIVE,
          updatedBy: currentUserId,
        },
      });

      nextStatus = OrderStatus.CONFIRMED;
      shouldEmitAvailabilityChanged = true;
    }

    const order = await tx.rentalOrder.update({
      where: { id: existingOrder.id },
      data: {
        status: nextStatus,
        paidTotal,
        paymentStatus,
        handoverAmountDue: Math.max(Number(existingOrder.handoverRequiredTotal) - paidTotal, 0),
      },
      include: this.rentalOrdersService.rentalOrderInclude(),
    });

    return { order, shouldEmitAvailabilityChanged };
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

  private resolvePaymentStatus(paidTotal: number, payableTotal: number): PaymentStatus {
    if (paidTotal <= 0) return PaymentStatus.UNPAID;
    return paidTotal >= payableTotal ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;
  }
}
