import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { ProductsService } from '../../products/products.service';
import { NormalizedRentalOrderItem, RentalPolicy } from './rental-order-availability.service';
import { RENTAL_ORDER_PRODUCT_INVALID } from '@/libs/constants/error.constants';

type RentalProduct = Awaited<ReturnType<ProductsService['getActiveProductsForRental']>>[number];

export type PricedRentalOrderItem = NormalizedRentalOrderItem & {
  productNameSnapshot: string;
  skuSnapshot: string;
  unitPrice: number;
  bookingHoldAmount: number;
  upfrontAmount: number;
  refundableDepositAmount: number;
  depositAmount: number;
  lineTotal: number;
};

@Injectable()
export class RentalOrderPricingService {
  priceItems(
    items: NormalizedRentalOrderItem[],
    products: RentalProduct[],
    rentalPolicy: RentalPolicy,
    startDate: Date,
    endDate: Date,
  ): PricedRentalOrderItem[] {
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
        lineTotal: unitPrice,
      };
    });
  }

  calculateTotals(items: PricedRentalOrderItem[], deliveryFeeTotal: number, discountTotal: number) {
    const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
    const depositTotal = items.reduce((total, item) => total + item.depositAmount, 0);
    const bookingHoldTotal = items.reduce((total, item) => total + item.bookingHoldAmount, 0);
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

  toCreateOrderItemsData(items: PricedRentalOrderItem[]): Prisma.RentalOrderItemCreateWithoutOrderInput[] {
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

  toCreateManyOrderItemsData(orderId: string, items: PricedRentalOrderItem[]): Prisma.RentalOrderItemCreateManyInput[] {
    return items.map((item) => ({
      orderId,
      productId: item.productId,
      assetUnitId: item.assetUnitId,
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

  toUpdateOrderItemData(item: PricedRentalOrderItem): Prisma.RentalOrderItemUpdateInput {
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

  private calculateRentalUnitPrice(product: RentalProduct, startDate: Date, endDate: Date): number {
    const durationHours = Math.ceil((endDate.getTime() - startDate.getTime()) / (60 * 60 * 1000));

    if (durationHours <= 6) {
      return Number(product.halfDayPrice);
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
}
