import { RENTAL_ORDER_PRODUCT_INVALID } from '@/libs/constants/error.constants';
import { Prisma } from '@generated/prisma/client';
import { RentalOrderItemStatus } from '@generated/prisma/enums';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ProductsService } from '../../products/products.service';
import { NormalizedRentalOrderItem, SystemSettingsForOrder } from './rental-order-availability.service';

type RentalProduct = Awaited<ReturnType<ProductsService['getActiveProductsForRental']>>[number];
type RentalAssetUnit = {
  id: string;
  serialNumber: string;
};
type RentalPriceTierSnapshot = {
  id: string;
  minDays: number;
  maxDays: number | null;
  dailyPrice: number;
  name: string | null;
};
type RentalPricingBreakdown = {
  pricingMode: 'HALF_DAY' | 'HOURLY_OVERAGE' | 'DAILY_TIER' | 'MIXED';
  pricingLabel: string;
  durationHours: number;
  billableDays: number;
  billableHalfDays: number;
  overageHours: number;
  unitPrice: number;
  appliedTierId: string | null;
  appliedTier: RentalPriceTierSnapshot | null;
};

const EPSILON = 1e-6;
const HOURS_PER_DAY = 24;
const MIN_HALF_DAY_HOURS = 6;
const FULL_DAY_THRESHOLD_HOURS = 12;

export type PricedRentalOrderItem = NormalizedRentalOrderItem & {
  unitPrice: number;
  bookingHoldAmount: number;
  depositAmount: number;
  lineTotal: number;
  snapshot: Prisma.InputJsonObject;
  startDate: Date;
  endDate: Date;
  blockedEndDate: Date;
  status: RentalOrderItemStatus;
};

@Injectable()
export class RentalOrderPricingService {
  priceItems(
    items: NormalizedRentalOrderItem[],
    products: RentalProduct[],
    assetUnits: RentalAssetUnit[],
    systemSettings: SystemSettingsForOrder,
    startDate: Date,
    endDate: Date,
    blockedEndDate: Date,
  ): PricedRentalOrderItem[] {
    const productsById = new Map(products.map((product) => [product.id, product]));
    const assetUnitsById = new Map(assetUnits.map((assetUnit) => [assetUnit.id, assetUnit]));

    return items.map((item) => {
      const product = productsById.get(item.productId);
      const assetUnit = assetUnitsById.get(item.assetUnitId);

      if (!product || !assetUnit) {
        throw new BadRequestException(RENTAL_ORDER_PRODUCT_INVALID);
      }

      const pricingBreakdown = this.calculateRentalPricing(product, startDate, endDate);
      const unitPrice = pricingBreakdown.unitPrice;
      const depositAmount = Number(product.depositAmount);
      const bookingHoldPricePerUnit = Number(systemSettings.bookingHoldPricePerUnit);
      const bookingHoldAmount = Math.min(bookingHoldPricePerUnit, depositAmount);
      const lineTotal = unitPrice;

      return {
        ...item,
        unitPrice,
        bookingHoldAmount,
        depositAmount,
        lineTotal,
        snapshot: this.buildItemSnapshot(product, assetUnit, {
          ...pricingBreakdown,
          depositAmount,
          bookingHoldAmount,
          lineTotal,
          startDate,
          endDate,
          blockedEndDate,
        }),
        startDate,
        endDate,
        blockedEndDate,
        status: RentalOrderItemStatus.PENDING,
      };
    });
  }

  calculateTotals(items: PricedRentalOrderItem[], deliveryFeeTotal: number, discountTotal: number) {
    const rentalFeeTotal = items.reduce((total, item) => total + item.lineTotal, 0);
    const originalDepositTotal = items.reduce((total, item) => total + item.depositAmount, 0);
    const bookingHoldTotal = Math.min(
      items.reduce((total, item) => total + item.bookingHoldAmount, 0),
      originalDepositTotal,
    );
    const lateFeeTotal = 0;
    const damageFeeTotal = 0;
    const compensationFeeTotal = 0;
    const chargeTotal = Math.max(rentalFeeTotal + lateFeeTotal + damageFeeTotal + compensationFeeTotal + deliveryFeeTotal - discountTotal, 0);
    const depositTotal = this.calculateProtectedDepositTotal(originalDepositTotal, chargeTotal);

    return {
      rentalFeeTotal,
      depositTotal,
      deliveryFeeTotal,
      discountTotal,
      lateFeeTotal,
      damageFeeTotal,
      compensationFeeTotal,
      bookingHoldTotal,
      chargeTotal,
      estimatedRefundTotal: Math.max(depositTotal - chargeTotal, 0),
      actualRefundTotal: 0,
    };
  }

  calculateProtectedDepositTotal(originalDepositTotal: number, chargeTotal: number): number {
    const rentalCharge = Math.max(chargeTotal, 0);
    let protectedDepositTotal = Math.max(originalDepositTotal, 0);

    if (protectedDepositTotal <= 0 && rentalCharge > 0) {
      protectedDepositTotal = rentalCharge * 2;
    }

    while (protectedDepositTotal / 2 < rentalCharge) {
      protectedDepositTotal *= 2;
    }

    return Math.round(protectedDepositTotal);
  }

  toCreateOrderItemsData(items: PricedRentalOrderItem[]): Prisma.RentalOrderItemCreateWithoutOrderInput[] {
    return items.map((item) => ({
      product: {
        connect: {
          id: item.productId,
        },
      },
      assetUnit: {
        connect: {
          id: item.assetUnitId,
        },
      },
      unitPrice: item.unitPrice,
      bookingHoldAmount: item.bookingHoldAmount,
      depositAmount: item.depositAmount,
      lineTotal: item.lineTotal,
      snapshot: item.snapshot,
      startDate: item.startDate,
      endDate: item.endDate,
      blockedEndDate: item.blockedEndDate,
      status: item.status,
      note: item.note,
    }));
  }

  toCreateManyOrderItemsData(orderId: string, items: PricedRentalOrderItem[]): Prisma.RentalOrderItemCreateManyInput[] {
    return items.map((item) => ({
      orderId,
      productId: item.productId,
      assetUnitId: item.assetUnitId,
      unitPrice: item.unitPrice,
      bookingHoldAmount: item.bookingHoldAmount,
      depositAmount: item.depositAmount,
      lineTotal: item.lineTotal,
      snapshot: item.snapshot,
      startDate: item.startDate,
      endDate: item.endDate,
      blockedEndDate: item.blockedEndDate,
      status: item.status,
      note: item.note,
    }));
  }

  toUpdateOrderItemData(item: PricedRentalOrderItem): Prisma.RentalOrderItemUpdateInput {
    return {
      product: {
        connect: {
          id: item.productId,
        },
      },
      assetUnit: {
        connect: {
          id: item.assetUnitId,
        },
      },
      unitPrice: item.unitPrice,
      bookingHoldAmount: item.bookingHoldAmount,
      depositAmount: item.depositAmount,
      lineTotal: item.lineTotal,
      snapshot: item.snapshot,
      startDate: item.startDate,
      endDate: item.endDate,
      blockedEndDate: item.blockedEndDate,
      status: item.status,
      note: item.note,
    };
  }

  private calculateRentalPricing(product: RentalProduct, startDate: Date, endDate: Date): RentalPricingBreakdown {
    const durationHours = (endDate.getTime() - startDate.getTime()) / (60 * 60 * 1000);
    const halfDayPrice = Number(product.halfDayPrice);
    const hourlyOveragePrice = Number(product.hourlyOveragePrice ?? 0);
    const roundHours = (hours: number) => Math.round(hours * 100) / 100;
    const buildDailyPricing = (
      billableDays: number,
      pricingMode: RentalPricingBreakdown['pricingMode'],
      partialTotal = 0,
      partialHours = 0,
    ): RentalPricingBreakdown => {
      const appliedTier = this.findTier(product, billableDays);
      const dailyPrice = Number(appliedTier?.dailyPrice ?? product.dailyPrice);

      return {
        pricingMode,
        pricingLabel: this.buildPricingLabel(appliedTier, billableDays, partialHours),
        durationHours: roundHours(durationHours),
        billableDays,
        billableHalfDays: partialHours > EPSILON ? 1 : 0,
        overageHours: partialHours > MIN_HALF_DAY_HOURS + EPSILON ? roundHours(partialHours - MIN_HALF_DAY_HOURS) : 0,
        unitPrice: Math.round(billableDays * dailyPrice + partialTotal),
        appliedTierId: appliedTier?.id ?? null,
        appliedTier: appliedTier ? this.toTierSnapshot(appliedTier) : null,
      };
    };
    const buildPartialPricing = (hours: number) => {
      if (hours <= EPSILON) {
        return { total: 0, mode: 'MIXED' as const, appliedTier: null };
      }

      if (hours <= MIN_HALF_DAY_HOURS + EPSILON) {
        return { total: halfDayPrice, mode: 'HALF_DAY' as const, appliedTier: null };
      }

      if (hours < FULL_DAY_THRESHOLD_HOURS - EPSILON) {
        return {
          total: halfDayPrice + (hours - MIN_HALF_DAY_HOURS) * hourlyOveragePrice,
          mode: 'HOURLY_OVERAGE' as const,
          appliedTier: null,
        };
      }

      const appliedTier = this.findTier(product, 1);
      return {
        total: Number(appliedTier?.dailyPrice ?? product.dailyPrice),
        mode: 'DAILY_TIER' as const,
        appliedTier,
      };
    };

    if (durationHours < HOURS_PER_DAY - EPSILON) {
      const partial = buildPartialPricing(durationHours);
      const appliedTier = partial.appliedTier;

      return {
        pricingMode: partial.mode,
        pricingLabel:
          partial.mode === 'DAILY_TIER'
            ? this.buildPricingLabel(appliedTier, 1, 0)
            : partial.mode === 'HALF_DAY' || partial.mode === 'HOURLY_OVERAGE'
              ? this.buildPartialPricingLabel(partial.mode)
              : 'Gia thue',
        durationHours: roundHours(durationHours),
        billableDays: partial.mode === 'DAILY_TIER' ? 1 : 0,
        billableHalfDays: partial.mode === 'DAILY_TIER' ? 0 : 1,
        overageHours: partial.mode === 'HOURLY_OVERAGE' ? roundHours(durationHours - MIN_HALF_DAY_HOURS) : 0,
        unitPrice: Math.round(partial.total),
        appliedTierId: appliedTier?.id ?? null,
        appliedTier: appliedTier ? this.toTierSnapshot(appliedTier) : null,
      };
    }

    const fullDays = Math.floor((durationHours + EPSILON) / HOURS_PER_DAY);
    const remainingHours = Math.max(0, durationHours - fullDays * HOURS_PER_DAY);

    if (remainingHours >= FULL_DAY_THRESHOLD_HOURS - EPSILON) {
      return buildDailyPricing(fullDays + 1, 'DAILY_TIER');
    }

    const partial = buildPartialPricing(remainingHours);
    return buildDailyPricing(fullDays, remainingHours > EPSILON ? 'MIXED' : 'DAILY_TIER', partial.total, remainingHours);
  }

  private buildItemSnapshot(
    product: RentalProduct,
    assetUnit: RentalAssetUnit,
    pricing: RentalPricingBreakdown & {
      depositAmount: number;
      bookingHoldAmount: number;
      lineTotal: number;
      startDate: Date;
      endDate: Date;
      blockedEndDate: Date;
    },
  ): Prisma.InputJsonObject {
    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        dailyPrice: Number(product.dailyPrice),
        halfDayPrice: Number(product.halfDayPrice),
        hourlyOveragePrice: product.hourlyOveragePrice === null ? null : Number(product.hourlyOveragePrice),
        depositAmount: Number(product.depositAmount),
        rentalPriceTiers: product.rentalPriceTiers.map((tier) => this.toTierSnapshot(tier)),
      },
      assetUnit: {
        id: assetUnit.id,
        serialNumber: assetUnit.serialNumber,
      },
      pricing: {
        pricingMode: pricing.pricingMode,
        pricingLabel: pricing.pricingLabel,
        durationHours: pricing.durationHours,
        billableDays: pricing.billableDays,
        billableHalfDays: pricing.billableHalfDays,
        overageHours: pricing.overageHours,
        unitPrice: pricing.unitPrice,
        depositAmount: pricing.depositAmount,
        bookingHoldAmount: pricing.bookingHoldAmount,
        lineTotal: pricing.lineTotal,
        appliedTierId: pricing.appliedTierId,
        appliedTier: pricing.appliedTier,
      },
      rentalWindow: {
        startDate: pricing.startDate.toISOString(),
        endDate: pricing.endDate.toISOString(),
        blockedEndDate: pricing.blockedEndDate.toISOString(),
      },
    };
  }

  private findTier(product: RentalProduct, days: number) {
    return product.rentalPriceTiers.find((priceTier) => {
      const maxDays = priceTier.maxDays ?? Number.POSITIVE_INFINITY;
      return priceTier.minDays <= days && days <= maxDays;
    });
  }

  private toTierSnapshot(tier: RentalProduct['rentalPriceTiers'][number]): RentalPriceTierSnapshot {
    return {
      id: tier.id,
      minDays: tier.minDays,
      maxDays: tier.maxDays,
      dailyPrice: Number(tier.dailyPrice),
      name: tier.name,
    };
  }

  private buildPricingLabel(tier: RentalProduct['rentalPriceTiers'][number] | null | undefined, billableDays: number, partialHours: number): string {
    const baseLabel = tier?.name ?? `Gia ${billableDays} ngay`;

    if (partialHours <= EPSILON) {
      return baseLabel;
    }

    return `${baseLabel} + ${this.buildPartialPricingLabel(partialHours > MIN_HALF_DAY_HOURS ? 'HOURLY_OVERAGE' : 'HALF_DAY')}`;
  }

  private buildPartialPricingLabel(mode: 'HALF_DAY' | 'HOURLY_OVERAGE'): string {
    return mode === 'HALF_DAY' ? 'Nua ngay' : 'Nua ngay + phu troi gio';
  }
}
