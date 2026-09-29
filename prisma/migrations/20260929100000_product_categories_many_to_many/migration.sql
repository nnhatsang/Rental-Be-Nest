-- Convert the legacy single product category into an explicit many-to-many relation.
-- Existing category assignments are copied before the legacy column is removed.
BEGIN;

CREATE TABLE "ProductCategoryAssignment" (
    "productId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategoryAssignment_pkey" PRIMARY KEY ("productId", "categoryId")
);

INSERT INTO "ProductCategoryAssignment" ("productId", "categoryId")
SELECT "id", "categoryId"
FROM "Product"
WHERE "categoryId" IS NOT NULL;

ALTER TABLE "ProductCategoryAssignment"
  ADD CONSTRAINT "ProductCategoryAssignment_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductCategoryAssignment"
  ADD CONSTRAINT "ProductCategoryAssignment_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ProductCategoryAssignment_categoryId_productId_idx"
  ON "ProductCategoryAssignment"("categoryId", "productId");

ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";
DROP INDEX "Product_categoryId_idx";
ALTER TABLE "Product" DROP COLUMN "categoryId";

COMMIT;
