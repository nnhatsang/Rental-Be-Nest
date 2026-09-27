import { Injectable } from '@nestjs/common';
import { RentalOrderPricingPolicy, RentalPricingProduct } from '../domain/rental-order-pricing.policy';

export type RentalQuoteAssetSelection = {
  product: RentalPricingProduct;
  assetUnitIds: string[];
  quantity: number;
  note?: string;
};

@Injectable()
export class RentalOrderPricingService {
  private readonly policy = new RentalOrderPricingPolicy();

  buildQuoteLines(input: {
    selections: RentalQuoteAssetSelection[];
    startDate: Date;
    endDate: Date;
    bookingHoldPerUnit: number;
  }) {
    const grouped = new Map<string, RentalQuoteAssetSelection>();
    for (const selection of input.selections) {
      const existing = grouped.get(selection.product.id);
      grouped.set(selection.product.id, {
        product: selection.product,
        assetUnitIds: [...(existing?.assetUnitIds ?? []), ...selection.assetUnitIds],
        quantity: (existing?.quantity ?? 0) + selection.quantity,
        note: selection.note ?? existing?.note,
      });
    }

    return [...grouped.values()].map((selection) => ({
      ...selection,
      quantity: selection.quantity,
      pricing: this.policy.calculateLine(
        selection.product,
        input.startDate,
        input.endDate,
        selection.quantity,
        input.bookingHoldPerUnit,
      ),
    }));
  }

  calculateTotals(lines: Array<{ pricing: ReturnType<RentalOrderPricingPolicy['calculateLine']> }>, deliveryFeeTotal = 0) {
    return this.policy.calculateTotals(lines.map((line) => line.pricing), deliveryFeeTotal);
  }
}
