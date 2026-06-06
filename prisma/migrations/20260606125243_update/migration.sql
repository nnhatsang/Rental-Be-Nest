-- AlterTable
ALTER TABLE "RentalOrder" ADD COLUMN     "holdExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RentalPolicy" ADD COLUMN     "holdPaymentExpiresInMinutes" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "ProductRentalPriceTier" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "minDays" INTEGER NOT NULL,
    "maxDays" INTEGER,
    "dailyPrice" DECIMAL(12,2) NOT NULL,
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProductRentalPriceTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRentalPriceTier_productId_idx" ON "ProductRentalPriceTier"("productId");

-- CreateIndex
CREATE INDEX "ProductRentalPriceTier_minDays_maxDays_idx" ON "ProductRentalPriceTier"("minDays", "maxDays");

-- CreateIndex
CREATE INDEX "RentalOrder_status_holdExpiresAt_idx" ON "RentalOrder"("status", "holdExpiresAt");

-- AddForeignKey
ALTER TABLE "ProductRentalPriceTier" ADD CONSTRAINT "ProductRentalPriceTier_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
