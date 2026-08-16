CREATE INDEX CONCURRENTLY IF NOT EXISTS "AssetReservation_active_product_range_idx"
ON "AssetReservation" ("productId", "startDate", "blockedEndDate")
WHERE "deletedAt" IS NULL
  AND "status" IN ('RESERVED', 'CHECKED_OUT');

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AssetReservation_active_asset_range_idx"
ON "AssetReservation" ("assetUnitId", "startDate", "blockedEndDate")
WHERE "deletedAt" IS NULL
  AND "status" IN ('RESERVED', 'CHECKED_OUT');

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AssetUnit_operational_product_idx"
ON "AssetUnit" ("productId")
WHERE "deletedAt" IS NULL
  AND "isActive" = true
  AND "status" = 'AVAILABLE'
  AND "condition" <> 'LOST';
