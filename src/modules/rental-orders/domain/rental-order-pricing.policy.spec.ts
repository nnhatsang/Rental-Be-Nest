import { RentalOrderPricingPolicy } from './rental-order-pricing.policy';

describe('RentalOrderPricingPolicy', () => {
  const policy = new RentalOrderPricingPolicy();
  const product = {
    id: 'product-1',
    name: 'Camera',
    sku: 'CAM-01',
    dailyPrice: 200_000,
    halfDayPrice: 120_000,
    hourlyOveragePrice: 25_000,
    depositAmount: 800_000,
    replacementValue: 10_000_000,
    rentalPriceTiers: [],
  };

  it('uses half-day price for a rental up to twelve hours', () => {
    const line = policy.calculateLine(product, new Date('2026-09-25T08:00:00Z'), new Date('2026-09-25T18:00:00Z'), 1, 50_000);

    expect(line.pricingMode).toBe('HALF_DAY');
    expect(line.unitRentalFee).toBe(120_000);
    expect(line.lineBookingHoldTotal).toBe(50_000);
  });

  it('applies a daily tier without counting booking hold as an extra charge', () => {
    const line = policy.calculateLine({ ...product, rentalPriceTiers: [{ id: 'tier-1', minDays: 3, maxDays: 6, dailyPrice: 180_000, name: '3-6 ngày' }] }, new Date('2026-09-25T08:00:00Z'), new Date('2026-09-28T08:00:00Z'), 2, 50_000);
    const totals = policy.calculateTotals([line], 30_000);

    expect(line.pricingMode).toBe('DAILY_TIER');
    expect(line.lineRentalTotal).toBe(1_080_000);
    expect(totals.bookingHoldTotal).toBe(100_000);
    expect(totals.deliveryFeeTotal).toBe(30_000);
    expect(totals.totalCustomerObligation).toBe(2_710_000);
    expect(totals.amountDueBeforeHandover).toBe(2_610_000);
  });

  it('uses the security deposit as the required total when half of it covers the charge', () => {
    const line = policy.calculateLine(product, new Date('2026-09-25T08:00:00Z'), new Date('2026-09-26T08:00:00Z'), 1, 50_000);
    const totals = policy.calculateTotals([line]);

    expect(totals.rentalFeeTotal).toBe(200_000);
    expect(totals.totalCustomerObligation).toBe(800_000);
    expect(totals.amountDueAtBooking).toBe(50_000);
    expect(totals.amountDueBeforeHandover).toBe(750_000);
  });

  it('adds the rental charge to the security deposit when half of it does not cover the charge', () => {
    const line = policy.calculateLine(
      { ...product, dailyPrice: 500_000 },
      new Date('2026-09-25T08:00:00Z'),
      new Date('2026-09-26T08:00:00Z'),
      1,
      50_000,
    );
    const totals = policy.calculateTotals([line]);

    expect(totals.totalCustomerObligation).toBe(1_300_000);
    expect(totals.amountDueBeforeHandover).toBe(1_250_000);
  });
});
