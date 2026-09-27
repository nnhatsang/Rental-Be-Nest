import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import {
  PaymentDirection,
  PaymentTransactionStatus,
  RentalChargeKind,
  RentalChargeStatus,
  RentalRefundStatus,
  RentalSettlementStatus,
  ReturnStatus,
} from '@generated/prisma/enums';
import { RENTAL_ORDER_HANDOVER_PAYMENT_INSUFFICIENT } from '@/libs/constants/error.constants';
import { PrismaService } from '@/modules/database/prisma.service';
import { calculateHandoverRequiredTotal } from '../domain/rental-order-pricing.policy';

type DbClient = PrismaService | Prisma.TransactionClient;

const money = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const numberOf = (value: Prisma.Decimal | number): number => Number(value.toString());

@Injectable()
export class RentalOrderFinancialService {
  constructor(private readonly prisma: PrismaService) {}

  async allocatePayment(paymentId: string, db: DbClient): Promise<void> {
    const payment = await db.paymentTransaction.findUnique({
      where: { id: paymentId },
      include: { allocations: true },
    });
    if (!payment || payment.direction !== PaymentDirection.INBOUND || payment.status !== PaymentTransactionStatus.SUCCESS) return;

    const existingAllocated = payment.allocations.reduce((total, allocation) => total + numberOf(allocation.amount), 0);
    let remaining = money(numberOf(payment.amount) - existingAllocated);
    if (remaining <= 0) return;

    const charges = await db.rentalOrderCharge.findMany({
      where: { orderId: payment.orderId, status: { notIn: [RentalChargeStatus.CANCELLED, RentalChargeStatus.WAIVED] } },
      include: { paymentAllocations: true },
      orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
    });

    for (const charge of charges) {
      if (remaining <= 0) break;
      const allocated = charge.paymentAllocations.reduce((total, allocation) => total + numberOf(allocation.amount), 0);
      const due = money(numberOf(charge.amount) - allocated);
      if (due <= 0) continue;
      const applied = Math.min(remaining, due);
      await db.paymentAllocation.upsert({
        where: { paymentId_chargeId: { paymentId: payment.id, chargeId: charge.id } },
        update: { amount: { increment: applied } },
        create: { paymentId: payment.id, chargeId: charge.id, amount: applied },
      });
      remaining = money(remaining - applied);
    }

    if (remaining > 0) {
      throw new BadRequestException(RENTAL_ORDER_HANDOVER_PAYMENT_INSUFFICIENT);
    }
  }

  async recalculateOrder(orderId: string, db: DbClient = this.prisma): Promise<void> {
    const [order, charges, payments, refunds] = await Promise.all([
      db.rentalOrder.findUnique({ where: { id: orderId }, select: { id: true, status: true, returnStatus: true } }),
      db.rentalOrderCharge.findMany({ where: { orderId }, include: { paymentAllocations: true } }),
      db.paymentTransaction.findMany({ where: { orderId } }),
      db.refund.findMany({ where: { orderId } }),
    ]);
    if (!order) return;

    const inactiveChargeStatuses: RentalChargeStatus[] = [RentalChargeStatus.CANCELLED, RentalChargeStatus.WAIVED];
    const activeCharges = charges.filter((charge) => !inactiveChargeStatuses.includes(charge.status));
    const chargeTotal = money(
      activeCharges
        .filter((charge) => charge.kind !== RentalChargeKind.BOOKING_HOLD && charge.kind !== RentalChargeKind.SECURITY_DEPOSIT)
        .reduce((total, charge) => total + numberOf(charge.amount), 0),
    );
    const inboundPaid = money(
      payments
        .filter((payment) => payment.direction === PaymentDirection.INBOUND && payment.status === PaymentTransactionStatus.SUCCESS)
        .reduce((total, payment) => total + numberOf(payment.amount), 0),
    );
    const actualRefundTotal = money(
      refunds.filter((refund) => refund.status === RentalRefundStatus.REFUNDED).reduce((total, refund) => total + numberOf(refund.amount), 0),
    );
    const sumKind = (kind: RentalChargeKind) => money(activeCharges.filter((charge) => charge.kind === kind).reduce((total, charge) => total + numberOf(charge.amount), 0));
    const rentalFeeTotal = sumKind(RentalChargeKind.RENTAL_FEE);
    const deliveryFeeTotal = sumKind(RentalChargeKind.DELIVERY_FEE);
    const bookingHoldTotal = sumKind(RentalChargeKind.BOOKING_HOLD);
    const securityDepositTotal = sumKind(RentalChargeKind.SECURITY_DEPOSIT);
    const lateFeeTotal = sumKind(RentalChargeKind.LATE_FEE);
    const damageCompensationTotal = sumKind(RentalChargeKind.DAMAGE_COMPENSATION);
    const cancellationFeeTotal = sumKind(RentalChargeKind.CANCELLATION_FEE);
    const totalCustomerObligation = calculateHandoverRequiredTotal(chargeTotal, securityDepositTotal);
    const amountDueAtBooking = this.outstandingForKind(activeCharges, RentalChargeKind.BOOKING_HOLD);
    const amountDueBeforeHandover = money(Math.max(0, totalCustomerObligation - inboundPaid));
    const refundDue = order.returnStatus === ReturnStatus.INSPECTED
      ? money(Math.max(0, inboundPaid - chargeTotal - actualRefundTotal))
      : 0;
    const additionalChargeDue = order.returnStatus === ReturnStatus.INSPECTED
      ? money(Math.max(0, chargeTotal + actualRefundTotal - inboundPaid))
      : 0;
    const settlementStatus = order.returnStatus !== ReturnStatus.INSPECTED
      ? inboundPaid < totalCustomerObligation ? RentalSettlementStatus.PAYMENT_DUE : RentalSettlementStatus.NOT_STARTED
      : additionalChargeDue > 0 ? RentalSettlementStatus.PAYMENT_DUE : refundDue > 0 ? RentalSettlementStatus.REFUND_DUE : RentalSettlementStatus.SETTLED;
    await Promise.all(
      charges
        .filter((charge) => !inactiveChargeStatuses.includes(charge.status))
        .map((charge) => {
          const allocated = charge.paymentAllocations.reduce((total, allocation) => total + numberOf(allocation.amount), 0);
          const status = allocated >= numberOf(charge.amount)
            ? RentalChargeStatus.SETTLED
            : allocated > 0
              ? RentalChargeStatus.PARTIALLY_SETTLED
              : RentalChargeStatus.OPEN;
          return db.rentalOrderCharge.update({ where: { id: charge.id }, data: { status } });
        }),
    );

    await db.rentalOrder.update({
      where: { id: orderId },
      data: {
        settlementStatus,
        rentalFeeTotal,
        deliveryFeeTotal,
        bookingHoldTotal,
        securityDepositTotal,
        totalCustomerObligation,
        amountDueAtBooking,
        amountDueBeforeHandover,
        lateFeeTotal,
        damageCompensationTotal,
        paidTotal: inboundPaid,
        actualRefundTotal,
        refundDue,
        additionalChargeDue,
      },
    });
  }

  private outstandingForKind(charges: Array<{ kind: RentalChargeKind; amount: Prisma.Decimal; paymentAllocations: Array<{ amount: Prisma.Decimal }> }>, kind: RentalChargeKind): number {
    return money(
      charges
        .filter((charge) => charge.kind === kind)
        .reduce((total, charge) => total + numberOf(charge.amount) - charge.paymentAllocations.reduce((sum, allocation) => sum + numberOf(allocation.amount), 0), 0),
    );
  }
}
