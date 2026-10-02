-- Add a stable display order for product categories.
BEGIN;

ALTER TABLE "ProductCategory"
  ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

WITH ordered_categories AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) - 1 AS "order"
  FROM "ProductCategory"
)
UPDATE "ProductCategory" AS category
SET "order" = ordered_categories."order"
FROM ordered_categories
WHERE category."id" = ordered_categories."id";

CREATE INDEX "ProductCategory_order_id_idx"
  ON "ProductCategory" ("order", "id");

COMMIT;
