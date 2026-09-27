export type RentalPriceTierLike = {
  id: string;
  minDays: number;
  maxDays: number | null;
  dailyPrice: number | { toString(): string };
  name: string | null;
};

export type RentalPricingProduct = {
  id: string;
  name: string;
  sku: string;
  dailyPrice: number | { toString(): string };
  halfDayPrice: number | { toString(): string };
  hourlyOveragePrice: number | { toString(): string } | null;
  depositAmount: number | { toString(): string };
  replacementValue: number | { toString(): string } | null;
  includedAccessories?: string | null;
  rentalPriceTiers: RentalPriceTierLike[];
};

export type RentalLinePrice = {
  durationHours: number;
  billableDays: number;
  unitRentalFee: number;
  unitDepositAmount: number;
  unitBookingHoldAmount: number;
  lineRentalTotal: number;
  lineDepositTotal: number;
  lineBookingHoldTotal: number;
  pricingMode: 'HALF_DAY' | 'DAILY' | 'DAILY_TIER';
  pricingLabel: string;
  appliedTierId: string | null;
};

const asNumber = (value: number | { toString(): string }): number => Number(value.toString());

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Calculates the amount that must be collected before handover.
 *
 * The security deposit is not always added on top of the rental charge. When
 * half of the deposit already covers the charge, the deposit itself is the
 * required amount. This is the existing rental-order business rule.
 */
export const calculateHandoverRequiredTotal = (chargeTotal: number, securityDepositTotal: number): number => {
  const normalizedChargeTotal = roundMoney(Math.max(0, chargeTotal));
  const normalizedSecurityDepositTotal = roundMoney(Math.max(0, securityDepositTotal));

  return roundMoney(
    normalizedSecurityDepositTotal / 2 >= normalizedChargeTotal
      ? normalizedSecurityDepositTotal
      : normalizedSecurityDepositTotal + normalizedChargeTotal,
  );
};

export class RentalOrderPricingPolicy {
  calculateLine(product: RentalPricingProduct, startDate: Date, endDate: Date, quantity: number, bookingHoldPerUnit: number): RentalLinePrice {
    const durationHours = (endDate.getTime() - startDate.getTime()) / 3_600_000;
    const billableDays = Math.max(1, Math.ceil(durationHours / 24));
    const tier = product.rentalPriceTiers.find(
      (candidate) => billableDays >= candidate.minDays && (candidate.maxDays === null || billableDays <= candidate.maxDays),
    );

    const dailyPrice = tier ? asNumber(tier.dailyPrice) : asNumber(product.dailyPrice);
    const isHalfDay = !tier && durationHours <= 12;
    const unitRentalFee = roundMoney(isHalfDay ? asNumber(product.halfDayPrice) : dailyPrice * billableDays);
    const unitDepositAmount = roundMoney(asNumber(product.depositAmount));
    const unitBookingHoldAmount = roundMoney(Math.min(Math.max(0, bookingHoldPerUnit), unitDepositAmount));

    return {
      durationHours: Math.round(durationHours * 100) / 100,
      billableDays,
      unitRentalFee,
      unitDepositAmount,
      unitBookingHoldAmount,
      lineRentalTotal: roundMoney(unitRentalFee * quantity),
      lineDepositTotal: roundMoney(unitDepositAmount * quantity),
      lineBookingHoldTotal: roundMoney(unitBookingHoldAmount * quantity),
      pricingMode: tier ? 'DAILY_TIER' : isHalfDay ? 'HALF_DAY' : 'DAILY',
      pricingLabel: tier?.name ?? (isHalfDay ? 'Nửa ngày' : `${billableDays} ngày`),
      appliedTierId: tier?.id ?? null,
    };
  }

  calculateTotals(lines: RentalLinePrice[], deliveryFeeTotal = 0) {
    const rentalFeeTotal = roundMoney(lines.reduce((total, line) => total + line.lineRentalTotal, 0));
    const bookingHoldTotal = roundMoney(lines.reduce((total, line) => total + line.lineBookingHoldTotal, 0));
    const securityDepositTotal = roundMoney(lines.reduce((total, line) => total + line.lineDepositTotal, 0));
    const normalizedDeliveryFeeTotal = roundMoney(Math.max(0, deliveryFeeTotal));
    const chargeTotal = roundMoney(rentalFeeTotal + normalizedDeliveryFeeTotal);
    const totalCustomerObligation = calculateHandoverRequiredTotal(chargeTotal, securityDepositTotal);

    return {
      rentalFeeTotal,
      bookingHoldTotal,
      securityDepositTotal,
      deliveryFeeTotal: normalizedDeliveryFeeTotal,
      totalCustomerObligation,
      amountDueAtBooking: bookingHoldTotal,
      amountDueBeforeHandover: roundMoney(Math.max(0, totalCustomerObligation - bookingHoldTotal)),
    };
  }
}
