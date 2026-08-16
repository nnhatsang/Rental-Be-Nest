CREATE INDEX CONCURRENTLY IF NOT EXISTS "AssetUnit_active_product_serial_idx"
ON "AssetUnit" ("productId", "serialNumber", "id")
WHERE "deletedAt" IS NULL
  AND "isActive" = true;
