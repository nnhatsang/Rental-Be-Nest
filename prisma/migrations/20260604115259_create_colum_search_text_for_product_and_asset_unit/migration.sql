-- AlterTable
ALTER TABLE "AssetUnit" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "AssetUnit_searchText_trgm_idx" ON "AssetUnit" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Product_searchText_trgm_idx" ON "Product" USING GIN ("searchText" gin_trgm_ops);
