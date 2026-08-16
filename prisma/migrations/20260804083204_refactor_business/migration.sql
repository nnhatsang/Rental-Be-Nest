/*
  Warnings:

  - The values [RESERVED,RENTED,INSPECTING,CLEANING,RETIRED,TRANSFERRING] on the enum `AssetStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [DRAFT,PENDING_PAYMENT,PENDING_CONFIRMATION,PREPARING,READY_FOR_PICKUP,DELIVERING,COMPLETED,REFUNDING,REFUNDED] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [PENDING] on the enum `RefundStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `deletedAt` on the `OrderStatusHistory` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_by` on the `OrderStatusHistory` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `OrderStatusHistory` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `OrderStatusHistory` table. All the data in the column will be lost.
  - You are about to drop the column `sortOrder` on the `ProductRentalPriceTier` table. All the data in the column will be lost.
  - You are about to drop the column `blockedEndDate` on the `RentalOrder` table. All the data in the column will be lost.
  - You are about to drop the column `customerAddressSnapshot` on the `RentalOrder` table. All the data in the column will be lost.
  - You are about to drop the column `customerEmailSnapshot` on the `RentalOrder` table. All the data in the column will be lost.
  - You are about to drop the column `customerIdentitySnapshot` on the `RentalOrder` table. All the data in the column will be lost.
  - You are about to drop the column `customerNameSnapshot` on the `RentalOrder` table. All the data in the column will be lost.
  - You are about to drop the column `customerPhoneSnapshot` on the `RentalOrder` table. All the data in the column will be lost.
  - You are about to drop the column `policySnapshot` on the `RentalOrder` table. All the data in the column will be lost.
  - You are about to drop the column `rentalPolicyId` on the `RentalOrder` table. All the data in the column will be lost.
  - You are about to drop the column `turnaroundMinutes` on the `RentalOrder` table. All the data in the column will be lost.
  - You are about to drop the column `productNameSnapshot` on the `RentalOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `refundableDepositAmount` on the `RentalOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `skuSnapshot` on the `RentalOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `upfrontAmount` on the `RentalOrderItem` table. All the data in the column will be lost.
  - You are about to drop the `AssetReservation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DamageReport` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderHandover` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RentalPolicy` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReturnInspection` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `customerSnapshot` to the `RentalOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `settingsSnapshot` to the `RentalOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `blockedEndDate` to the `RentalOrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endDate` to the `RentalOrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `RentalOrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RentalOrderItemStatus" AS ENUM ('PENDING', 'ACTIVE', 'RETURNED', 'CANCELLED');

-- DropIndex
DROP INDEX IF EXISTS "AssetUnit_operational_product_idx";

-- AlterEnum
BEGIN;
CREATE TYPE "AssetStatus_new" AS ENUM ('AVAILABLE', 'MAINTENANCE', 'LOST');
ALTER TABLE "public"."AssetUnit" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "AssetUnit" ALTER COLUMN "status" TYPE "AssetStatus_new" USING ("status"::text::"AssetStatus_new");
ALTER TYPE "AssetStatus" RENAME TO "AssetStatus_old";
ALTER TYPE "AssetStatus_new" RENAME TO "AssetStatus";
DROP TYPE "public"."AssetStatus_old";
ALTER TABLE "AssetUnit" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('CREATED', 'CONFIRMED', 'RENTING', 'OVERDUE', 'RETURNED', 'DONE', 'CANCELLED', 'DISPUTED');
ALTER TABLE "public"."RentalOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "RentalOrder" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "fromStatus" TYPE "OrderStatus_new" USING ("fromStatus"::text::"OrderStatus_new");
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "toStatus" TYPE "OrderStatus_new" USING ("toStatus"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "RentalOrder" ALTER COLUMN "status" SET DEFAULT 'CREATED';
COMMIT;

-- AlterEnum
ALTER TYPE "PaymentKind" ADD VALUE 'REFUND';

-- AlterEnum
BEGIN;
CREATE TYPE "RefundStatus_new" AS ENUM ('NOT_REQUIRED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED');
ALTER TABLE "public"."RentalOrder" ALTER COLUMN "refundStatus" DROP DEFAULT;
ALTER TABLE "RentalOrder" ALTER COLUMN "refundStatus" TYPE "RefundStatus_new" USING ("refundStatus"::text::"RefundStatus_new");
ALTER TYPE "RefundStatus" RENAME TO "RefundStatus_old";
ALTER TYPE "RefundStatus_new" RENAME TO "RefundStatus";
DROP TYPE "public"."RefundStatus_old";
ALTER TABLE "RentalOrder" ALTER COLUMN "refundStatus" SET DEFAULT 'NOT_REQUIRED';
COMMIT;

-- DropForeignKey
ALTER TABLE "AssetReservation" DROP CONSTRAINT "AssetReservation_assetUnitId_fkey";

-- DropForeignKey
ALTER TABLE "AssetReservation" DROP CONSTRAINT "AssetReservation_orderId_fkey";

-- DropForeignKey
ALTER TABLE "AssetReservation" DROP CONSTRAINT "AssetReservation_orderItemId_fkey";

-- DropForeignKey
ALTER TABLE "AssetReservation" DROP CONSTRAINT "AssetReservation_productId_fkey";

-- DropForeignKey
ALTER TABLE "DamageReport" DROP CONSTRAINT "DamageReport_assetUnitId_fkey";

-- DropForeignKey
ALTER TABLE "DamageReport" DROP CONSTRAINT "DamageReport_inspectionId_fkey";

-- DropForeignKey
ALTER TABLE "DamageReport" DROP CONSTRAINT "DamageReport_productId_fkey";

-- DropForeignKey
ALTER TABLE "OrderEvent" DROP CONSTRAINT "OrderEvent_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderHandover" DROP CONSTRAINT "OrderHandover_orderId_fkey";

-- DropForeignKey
ALTER TABLE "RentalOrder" DROP CONSTRAINT "RentalOrder_rentalPolicyId_fkey";

-- DropForeignKey
ALTER TABLE "RentalOrderItem" DROP CONSTRAINT "RentalOrderItem_assetUnitId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnInspection" DROP CONSTRAINT "ReturnInspection_orderId_fkey";

-- DropIndex
DROP INDEX "OrderStatusHistory_created_by_idx";

-- DropIndex
DROP INDEX "RentalOrder_rentalPolicyId_idx";

-- DropIndex
DROP INDEX "RentalOrder_startDate_blockedEndDate_idx";

-- DropIndex
DROP INDEX "RentalOrder_status_startDate_blockedEndDate_deletedAt_idx";

-- DropIndex
DROP INDEX "RentalOrderItem_assetUnitId_deletedAt_idx";

-- DropIndex
DROP INDEX "RentalOrderItem_productId_deletedAt_idx";

-- AlterTable
ALTER TABLE "OrderStatusHistory" DROP COLUMN "deletedAt",
DROP COLUMN "deleted_by",
DROP COLUMN "updatedAt",
DROP COLUMN "updated_by";

-- AlterTable
ALTER TABLE "ProductRentalPriceTier" DROP COLUMN "sortOrder";

-- AlterTable
ALTER TABLE "RentalOrder" DROP COLUMN "blockedEndDate",
DROP COLUMN "customerAddressSnapshot",
DROP COLUMN "customerEmailSnapshot",
DROP COLUMN "customerIdentitySnapshot",
DROP COLUMN "customerNameSnapshot",
DROP COLUMN "customerPhoneSnapshot",
DROP COLUMN "policySnapshot",
DROP COLUMN "rentalPolicyId",
DROP COLUMN "turnaroundMinutes",
ADD COLUMN     "customerSnapshot" JSONB NOT NULL,
ADD COLUMN     "settingsSnapshot" JSONB NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'CREATED';

-- AlterTable
ALTER TABLE "RentalOrderItem" DROP COLUMN "productNameSnapshot",
DROP COLUMN "refundableDepositAmount",
DROP COLUMN "skuSnapshot",
DROP COLUMN "upfrontAmount",
ADD COLUMN     "blockedEndDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "snapshot" JSONB,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "RentalOrderItemStatus" NOT NULL DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE "AssetReservation";

-- DropTable
DROP TABLE "DamageReport";

-- DropTable
DROP TABLE "OrderEvent";

-- DropTable
DROP TABLE "OrderHandover";

-- DropTable
DROP TABLE "RentalPolicy";

-- DropTable
DROP TABLE "ReturnInspection";

-- DropEnum
DROP TYPE "AssetReservationStatus";

-- DropEnum
DROP TYPE "DamageSeverity";

-- DropEnum
DROP TYPE "HandoverType";

-- DropEnum
DROP TYPE "OrderAdjustmentType";

-- DropEnum
DROP TYPE "OrderEventType";

-- DropEnum
DROP TYPE "OrderItemStatus";

-- DropEnum
DROP TYPE "ReturnResult";

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "bookingHoldPricePerUnit" DECIMAL(12,2) NOT NULL DEFAULT 50000,
    "bookingBufferTimeMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxRentalTimeDays" INTEGER NOT NULL DEFAULT 30,
    "maxLateReturnTimeHours" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentalOrder_startDate_idx" ON "RentalOrder"("startDate");

-- CreateIndex
CREATE INDEX "RentalOrder_status_startDate_deletedAt_idx" ON "RentalOrder"("status", "startDate", "deletedAt");

-- CreateIndex
CREATE INDEX "RentalOrderItem_assetUnitId_startDate_blockedEndDate_idx" ON "RentalOrderItem"("assetUnitId", "startDate", "blockedEndDate");

-- CreateIndex
CREATE INDEX "RentalOrderItem_status_idx" ON "RentalOrderItem"("status");

-- CreateIndex
CREATE INDEX "RentalOrderItem_deletedAt_idx" ON "RentalOrderItem"("deletedAt");

-- AddForeignKey
ALTER TABLE "RentalOrderItem" ADD CONSTRAINT "RentalOrderItem_assetUnitId_fkey" FOREIGN KEY ("assetUnitId") REFERENCES "AssetUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
