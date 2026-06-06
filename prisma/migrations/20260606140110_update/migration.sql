-- AlterTable
ALTER TABLE "RentalOrder" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "RentalOrder_searchText_trgm_idx" ON "RentalOrder" USING GIN ("searchText" gin_trgm_ops);
