-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "Customer_searchText_trgm_idx" ON "Customer" USING GIN ("searchText" gin_trgm_ops);
