/*
  Warnings:

  - Added the required column `blockedEndDate` to the `RentalOrder` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StoreClosureType" AS ENUM ('OFF', 'HOLIDAY', 'MAINTENANCE', 'INTERNAL_EVENT', 'OTHER');

-- AlterTable
ALTER TABLE "RentalOrder" ADD COLUMN     "blockedEndDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "bookingHoldTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "handoverDueTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "rentalPolicyId" TEXT,
ADD COLUMN     "turnaroundMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "upfrontTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RentalOrderItem" ADD COLUMN     "bookingHoldAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "refundableDepositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "upfrontAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RentalPolicy" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bookingHoldAmountPerUnit" DECIMAL(12,2) NOT NULL DEFAULT 50000,
    "turnaroundMinutes" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreBusinessHour" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreBusinessHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreClosure" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "type" "StoreClosureType" NOT NULL DEFAULT 'OFF',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StoreClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RentalPolicy_code_key" ON "RentalPolicy"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StoreBusinessHour_dayOfWeek_key" ON "StoreBusinessHour"("dayOfWeek");

-- CreateIndex
CREATE INDEX "StoreClosure_startDate_endDate_idx" ON "StoreClosure"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "StoreClosure_type_idx" ON "StoreClosure"("type");

-- CreateIndex
CREATE INDEX "StoreClosure_deletedAt_idx" ON "StoreClosure"("deletedAt");

-- CreateIndex
CREATE INDEX "RentalOrder_rentalPolicyId_idx" ON "RentalOrder"("rentalPolicyId");

-- CreateIndex
CREATE INDEX "RentalOrder_startDate_blockedEndDate_idx" ON "RentalOrder"("startDate", "blockedEndDate");

-- AddForeignKey
ALTER TABLE "RentalOrder" ADD CONSTRAINT "RentalOrder_rentalPolicyId_fkey" FOREIGN KEY ("rentalPolicyId") REFERENCES "RentalPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
