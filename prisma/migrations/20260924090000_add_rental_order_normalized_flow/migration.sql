-- Dev cutover for the rental-order bounded context.
-- This migration intentionally drops the legacy RentalOrderItem/PaymentRecord tables
-- because the development database does not need a data-preserving migration.

-- Explicitly clear the old rental-order aggregate and all dependent rental data.
-- Do not run this migration against a production database.
TRUNCATE TABLE "RentalOrder" CASCADE;

CREATE TYPE "HandoverStatus" AS ENUM ('PENDING_PAYMENT', 'READY', 'HANDED_OVER');
CREATE TYPE "ReturnStatus" AS ENUM ('NOT_RETURNED', 'RETURNED', 'INSPECTED');
CREATE TYPE "RentalSettlementStatus" AS ENUM ('NOT_STARTED', 'PAYMENT_DUE', 'REFUND_DUE', 'SETTLED', 'DISPUTED');
CREATE TYPE "RentalChargeKind" AS ENUM ('BOOKING_HOLD', 'RENTAL_FEE', 'LATE_FEE', 'DELIVERY_FEE', 'SECURITY_DEPOSIT', 'DAMAGE_COMPENSATION', 'CANCELLATION_FEE', 'OTHER_CHARGE');
CREATE TYPE "RentalChargeStatus" AS ENUM ('OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'WAIVED', 'CANCELLED');
CREATE TYPE "PaymentDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED');
CREATE TYPE "RentalRefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'REFUNDED', 'FAILED');
CREATE TYPE "RentalAllocationSource" AS ENUM ('ADMIN_SELECTED', 'AUTO_ALLOCATED');
CREATE TYPE "RentalAllocationStatus" AS ENUM ('REQUESTED', 'RESERVED', 'HANDED_OVER', 'RETURNED', 'RELEASED');
CREATE TYPE "RentalInspectionType" AS ENUM ('HANDOVER', 'RETURN');
CREATE TYPE "RentalInspectionCondition" AS ENUM ('GOOD', 'DAMAGED', 'MISSING', 'NEEDS_MAINTENANCE');
CREATE TYPE "RentalAccessoryStatus" AS ENUM ('OK', 'MISSING', 'DAMAGED');
CREATE TYPE "RentalIncidentType" AS ENUM ('DAMAGE', 'LOSS', 'MISSING_ACCESSORY', 'LATE_RETURN');
CREATE TYPE "RentalIncidentStatus" AS ENUM ('OPEN', 'WAIVED', 'CHARGED', 'RESOLVED');

BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('CREATED', 'CONFIRMED', 'RENTING', 'RETURNED', 'DONE', 'CANCELLED', 'DISPUTED');
ALTER TABLE "RentalOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "RentalOrder"
  ALTER COLUMN "status" TYPE "OrderStatus_new"
  USING (CASE WHEN "status"::text = 'OVERDUE' THEN 'RENTING' ELSE "status"::text END)::"OrderStatus_new";
ALTER TABLE "OrderStatusHistory"
  ALTER COLUMN "fromStatus" TYPE "OrderStatus_new"
  USING (CASE WHEN "fromStatus"::text = 'OVERDUE' THEN 'RENTING' ELSE "fromStatus"::text END)::"OrderStatus_new",
  ALTER COLUMN "toStatus" TYPE "OrderStatus_new"
  USING (CASE WHEN "toStatus"::text = 'OVERDUE' THEN 'RENTING' ELSE "toStatus"::text END)::"OrderStatus_new";
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "RentalOrder" ALTER COLUMN "status" SET DEFAULT 'CREATED';
COMMIT;

ALTER TABLE "RentalOrder"
  ADD COLUMN "handoverStatus" "HandoverStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  ADD COLUMN "returnStatus" "ReturnStatus" NOT NULL DEFAULT 'NOT_RETURNED',
  ADD COLUMN "settlementStatus" "RentalSettlementStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "policyVersion" TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN "securityDepositTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalCustomerObligation" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "amountDueAtBooking" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "amountDueBeforeHandover" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "refundDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "additionalChargeDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "damageCompensationTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "quoteId" UUID;

ALTER TABLE "RentalOrder"
  DROP COLUMN IF EXISTS "paymentStatus",
  DROP COLUMN IF EXISTS "refundStatus",
  DROP COLUMN IF EXISTS "collateralType",
  DROP COLUMN IF EXISTS "collateralDescription",
  DROP COLUMN IF EXISTS "depositTotal",
  DROP COLUMN IF EXISTS "damageFeeTotal",
  DROP COLUMN IF EXISTS "discountTotal",
  DROP COLUMN IF EXISTS "compensationFeeTotal",
  DROP COLUMN IF EXISTS "chargeTotal",
  DROP COLUMN IF EXISTS "estimatedRefundTotal",
  DROP COLUMN IF EXISTS "adjustedDepositTotal",
  DROP COLUMN IF EXISTS "handoverRequiredTotal",
  DROP COLUMN IF EXISTS "handoverAmountDue";

CREATE TABLE "RentalOrderQuote" (
  "id" UUID NOT NULL,
  "customerId" UUID,
  "source" "OrderSource" NOT NULL DEFAULT 'ADMIN',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "pickupMethod" "PickupMethod" NOT NULL,
  "deliveryAddress" TEXT,
  "requestSnapshot" JSONB NOT NULL,
  "responseSnapshot" JSONB NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID,
  CONSTRAINT "RentalOrderQuote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalOrderLine" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitRentalFee" DECIMAL(12,2) NOT NULL,
  "unitDepositAmount" DECIMAL(12,2) NOT NULL,
  "unitBookingHoldAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "lineRentalTotal" DECIMAL(12,2) NOT NULL,
  "lineDepositTotal" DECIMAL(12,2) NOT NULL,
  "lineBookingHoldTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "pricingSnapshot" JSONB NOT NULL,
  "accessoriesSnapshot" JSONB,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentalOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalAssetAllocation" (
  "id" UUID NOT NULL,
  "orderLineId" UUID NOT NULL,
  "assetUnitId" UUID NOT NULL,
  "source" "RentalAllocationSource" NOT NULL DEFAULT 'ADMIN_SELECTED',
  "status" "RentalAllocationStatus" NOT NULL DEFAULT 'REQUESTED',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "blockedEndDate" TIMESTAMP(3) NOT NULL,
  "allocatedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentalAssetAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalOrderCharge" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "orderLineId" UUID,
  "kind" "RentalChargeKind" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" "RentalChargeStatus" NOT NULL DEFAULT 'OPEN',
  "refundable" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentalOrderCharge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentTransaction" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "direction" "PaymentDirection" NOT NULL DEFAULT 'INBOUND',
  "amount" DECIMAL(12,2) NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING',
  "referenceCode" TEXT,
  "idempotencyKey" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID NOT NULL,
  CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentAllocation" (
  "paymentId" UUID NOT NULL,
  "chargeId" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("paymentId", "chargeId")
);

CREATE TABLE "Refund" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "paymentId" UUID,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" "RentalRefundStatus" NOT NULL DEFAULT 'PENDING',
  "method" "PaymentMethod" NOT NULL,
  "referenceCode" TEXT,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID NOT NULL,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalInspection" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "type" "RentalInspectionType" NOT NULL,
  "inspectedBy" UUID NOT NULL,
  "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  CONSTRAINT "RentalInspection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalInspectionItem" (
  "id" UUID NOT NULL,
  "inspectionId" UUID NOT NULL,
  "allocationId" UUID NOT NULL,
  "condition" "RentalInspectionCondition" NOT NULL,
  "note" TEXT,
  CONSTRAINT "RentalInspectionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalInspectionAccessory" (
  "id" UUID NOT NULL,
  "inspectionItemId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "expectedQuantity" INTEGER NOT NULL,
  "actualQuantity" INTEGER NOT NULL,
  "status" "RentalAccessoryStatus" NOT NULL,
  "note" TEXT,
  CONSTRAINT "RentalInspectionAccessory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalIncident" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "allocationId" UUID,
  "type" "RentalIncidentType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "note" TEXT,
  "status" "RentalIncidentStatus" NOT NULL DEFAULT 'OPEN',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID NOT NULL,
  CONSTRAINT "RentalIncident_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RentalOrder_quoteId_key" ON "RentalOrder"("quoteId");
CREATE INDEX "RentalOrderQuote_expiresAt_idx" ON "RentalOrderQuote"("expiresAt");
CREATE INDEX "RentalOrderQuote_customerId_idx" ON "RentalOrderQuote"("customerId");
CREATE INDEX "RentalOrderLine_orderId_idx" ON "RentalOrderLine"("orderId");
CREATE INDEX "RentalOrderLine_productId_idx" ON "RentalOrderLine"("productId");
CREATE UNIQUE INDEX "RentalOrderLine_orderId_productId_key" ON "RentalOrderLine"("orderId", "productId");
CREATE UNIQUE INDEX "RentalAssetAllocation_orderLineId_assetUnitId_key" ON "RentalAssetAllocation"("orderLineId", "assetUnitId");
CREATE INDEX "RentalAssetAllocation_assetUnitId_startDate_blockedEndDate_idx" ON "RentalAssetAllocation"("assetUnitId", "startDate", "blockedEndDate");
CREATE INDEX "RentalAssetAllocation_status_idx" ON "RentalAssetAllocation"("status");
CREATE INDEX "RentalOrderCharge_orderId_kind_idx" ON "RentalOrderCharge"("orderId", "kind");
CREATE INDEX "RentalOrderCharge_status_idx" ON "RentalOrderCharge"("status");
CREATE UNIQUE INDEX "PaymentTransaction_orderId_idempotencyKey_key" ON "PaymentTransaction"("orderId", "idempotencyKey");
CREATE INDEX "PaymentTransaction_orderId_status_idx" ON "PaymentTransaction"("orderId", "status");
CREATE INDEX "PaymentTransaction_referenceCode_idx" ON "PaymentTransaction"("referenceCode");
CREATE INDEX "PaymentAllocation_chargeId_idx" ON "PaymentAllocation"("chargeId");
CREATE UNIQUE INDEX "Refund_paymentId_key" ON "Refund"("paymentId");
CREATE INDEX "Refund_orderId_status_idx" ON "Refund"("orderId", "status");
CREATE UNIQUE INDEX "RentalInspection_orderId_type_key" ON "RentalInspection"("orderId", "type");
CREATE UNIQUE INDEX "RentalInspectionItem_inspectionId_allocationId_key" ON "RentalInspectionItem"("inspectionId", "allocationId");
CREATE INDEX "RentalInspectionAccessory_inspectionItemId_idx" ON "RentalInspectionAccessory"("inspectionItemId");
CREATE INDEX "RentalIncident_orderId_type_idx" ON "RentalIncident"("orderId", "type");
CREATE INDEX "RentalIncident_allocationId_idx" ON "RentalIncident"("allocationId");

ALTER TABLE "RentalOrder" ADD CONSTRAINT "RentalOrder_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "RentalOrderQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalOrderLine" ADD CONSTRAINT "RentalOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RentalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalOrderLine" ADD CONSTRAINT "RentalOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalAssetAllocation" ADD CONSTRAINT "RentalAssetAllocation_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "RentalOrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalAssetAllocation" ADD CONSTRAINT "RentalAssetAllocation_assetUnitId_fkey" FOREIGN KEY ("assetUnitId") REFERENCES "AssetUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalOrderCharge" ADD CONSTRAINT "RentalOrderCharge_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RentalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalOrderCharge" ADD CONSTRAINT "RentalOrderCharge_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "RentalOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RentalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PaymentTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "RentalOrderCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RentalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalInspection" ADD CONSTRAINT "RentalInspection_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RentalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalInspectionItem" ADD CONSTRAINT "RentalInspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "RentalInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalInspectionItem" ADD CONSTRAINT "RentalInspectionItem_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "RentalAssetAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalInspectionAccessory" ADD CONSTRAINT "RentalInspectionAccessory_inspectionItemId_fkey" FOREIGN KEY ("inspectionItemId") REFERENCES "RentalInspectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalIncident" ADD CONSTRAINT "RentalIncident_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RentalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalIncident" ADD CONSTRAINT "RentalIncident_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "RentalAssetAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Dev-only cleanup: the normalized ledger is now the only rental-order write model.
DROP TABLE IF EXISTS "PaymentRecord" CASCADE;
DROP TABLE IF EXISTS "RentalOrderItem" CASCADE;
DROP TYPE IF EXISTS "PaymentKind" CASCADE;
DROP TYPE IF EXISTS "PaymentRecordStatus" CASCADE;
DROP TYPE IF EXISTS "RentalOrderItemStatus" CASCADE;
DROP TYPE IF EXISTS "PaymentStatus" CASCADE;
DROP TYPE IF EXISTS "RefundStatus" CASCADE;
DROP TYPE IF EXISTS "CollateralType" CASCADE;
