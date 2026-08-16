-- Phase 1: split payment/refund status and simplify payment kind.
CREATE TYPE "RefundStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED');

ALTER TABLE "RentalOrder"
  ADD COLUMN "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "policySnapshot" JSONB,
  ADD COLUMN "rentalFeeTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "amountDueAtHandover" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "compensationFeeTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "chargeTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "amountDueNow" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "estimatedRefundTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "actualRefundTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "RentalOrder"
SET
  "refundStatus" = CASE
    WHEN "paymentStatus"::text = 'REFUNDED' THEN 'REFUNDED'::"RefundStatus"
    WHEN "paymentStatus"::text = 'PARTIALLY_REFUNDED' THEN 'PARTIALLY_REFUNDED'::"RefundStatus"
    ELSE 'NOT_REQUIRED'::"RefundStatus"
  END,
  "rentalFeeTotal" = "subtotal",
  "amountDueAtHandover" = "handoverDueTotal",
  "compensationFeeTotal" = 0,
  "chargeTotal" = GREATEST("subtotal" + "lateFeeTotal" + "damageFeeTotal" + "deliveryFeeTotal" - "discountTotal", 0),
  "amountDueNow" = "remainingTotal",
  "estimatedRefundTotal" = "refundTotal",
  "actualRefundTotal" = 0;

CREATE TYPE "PaymentStatus_new" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

ALTER TABLE "RentalOrder"
  ALTER COLUMN "paymentStatus" DROP DEFAULT,
  ALTER COLUMN "paymentStatus" TYPE "PaymentStatus_new"
  USING (
    CASE
      WHEN "paymentStatus"::text IN ('REFUNDED', 'PARTIALLY_REFUNDED') THEN 'PAID'
      ELSE "paymentStatus"::text
    END
  )::"PaymentStatus_new",
  ALTER COLUMN "paymentStatus" SET DEFAULT 'UNPAID';

DROP TYPE "PaymentStatus";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";

CREATE TYPE "PaymentKind_new" AS ENUM ('BOOKING_HOLD', 'HANDOVER_PAYMENT', 'ADDITIONAL_CHARGE', 'OTHER');

ALTER TABLE "PaymentRecord"
  ALTER COLUMN "kind" TYPE "PaymentKind_new"
  USING (
    CASE "kind"::text
      WHEN 'HOLD_FEE' THEN 'BOOKING_HOLD'
      WHEN 'DEPOSIT' THEN 'HANDOVER_PAYMENT'
      WHEN 'RENTAL_FEE' THEN 'HANDOVER_PAYMENT'
      WHEN 'LATE_FEE' THEN 'ADDITIONAL_CHARGE'
      WHEN 'DAMAGE_FEE' THEN 'ADDITIONAL_CHARGE'
      WHEN 'DELIVERY_FEE' THEN 'ADDITIONAL_CHARGE'
      ELSE 'OTHER'
    END
  )::"PaymentKind_new";

DROP TYPE "PaymentKind";
ALTER TYPE "PaymentKind_new" RENAME TO "PaymentKind";

CREATE TYPE "OrderItemStatus" AS ENUM ('ACTIVE', 'REPLACED', 'CANCELLED', 'RETURNED', 'LOST', 'DAMAGED');
CREATE TYPE "OrderAdjustmentType" AS ENUM (
  'LATE_FEE',
  'DAMAGE_FEE',
  'DISCOUNT',
  'COUPON_DISCOUNT',
  'DELIVERY_FEE',
  'NEXT_BOOKING_COMPENSATION',
  'MANUAL_ADJUSTMENT'
);

ALTER TABLE "RentalOrder" DROP CONSTRAINT IF EXISTS "RentalOrder_assignedToId_fkey";
DROP INDEX IF EXISTS "RentalOrder_assignedToId_idx";
ALTER TABLE "RentalOrder"
  DROP COLUMN "subtotal",
  DROP COLUMN "upfrontTotal",
  DROP COLUMN "handoverDueTotal",
  DROP COLUMN "remainingTotal",
  DROP COLUMN "refundTotal",
  DROP COLUMN "assignedToId";

CREATE INDEX "RentalOrder_refundStatus_idx" ON "RentalOrder"("refundStatus");
