CREATE EXTENSION IF NOT EXISTS "btree_gist";

CREATE TYPE "AssetReservationStatus" AS ENUM ('RESERVED', 'CHECKED_OUT', 'RETURNED', 'CANCELLED');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "RentalOrderItem" roi
    WHERE roi."deletedAt" IS NULL
      AND roi."assetUnitId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot make RentalOrderItem.assetUnitId required while active order items without assetUnitId exist.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "RentalOrderItem" a
    JOIN "RentalOrder" ao ON ao."id" = a."orderId"
    JOIN "RentalOrderItem" b ON b."assetUnitId" = a."assetUnitId" AND b."id" > a."id"
    JOIN "RentalOrder" bo ON bo."id" = b."orderId"
    WHERE a."deletedAt" IS NULL
      AND b."deletedAt" IS NULL
      AND ao."deletedAt" IS NULL
      AND bo."deletedAt" IS NULL
      AND a."assetUnitId" IS NOT NULL
      AND ao."status" IN ('CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'DELIVERING', 'RENTING', 'OVERDUE')
      AND bo."status" IN ('CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'DELIVERING', 'RENTING', 'OVERDUE')
      AND ao."startDate" < bo."blockedEndDate"
      AND ao."blockedEndDate" > bo."startDate"
  ) THEN
    RAISE EXCEPTION 'Cannot create AssetReservation overlap constraint because existing overlapping asset bookings were found.';
  END IF;
END $$;

ALTER TABLE "RentalOrderItem" ALTER COLUMN "assetUnitId" SET NOT NULL;

CREATE TABLE "AssetReservation" (
  "id" UUID NOT NULL,
  "assetUnitId" UUID NOT NULL,
  "orderItemId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "blockedEndDate" TIMESTAMP(3) NOT NULL,
  "status" "AssetReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "AssetReservation_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AssetReservation" (
  "id",
  "assetUnitId",
  "orderItemId",
  "orderId",
  "productId",
  "startDate",
  "endDate",
  "blockedEndDate",
  "status",
  "createdAt",
  "updatedAt",
  "deletedAt"
)
SELECT
  (
    substr(md5(roi."id"::text || ':asset-reservation'), 1, 8) || '-' ||
    substr(md5(roi."id"::text || ':asset-reservation'), 9, 4) || '-' ||
    substr(md5(roi."id"::text || ':asset-reservation'), 13, 4) || '-' ||
    substr(md5(roi."id"::text || ':asset-reservation'), 17, 4) || '-' ||
    substr(md5(roi."id"::text || ':asset-reservation'), 21, 12)
  )::uuid,
  roi."assetUnitId",
  roi."id",
  ro."id",
  roi."productId",
  ro."startDate",
  ro."endDate",
  ro."blockedEndDate",
  CASE
    WHEN ro."status" IN ('CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'DELIVERING') THEN 'RESERVED'::"AssetReservationStatus"
    WHEN ro."status" IN ('RENTING', 'OVERDUE') THEN 'CHECKED_OUT'::"AssetReservationStatus"
    WHEN ro."status" IN ('RETURNED', 'COMPLETED') THEN 'RETURNED'::"AssetReservationStatus"
    WHEN ro."status" IN ('CANCELLED', 'REFUNDING', 'REFUNDED', 'DISPUTED') THEN 'CANCELLED'::"AssetReservationStatus"
    ELSE 'RESERVED'::"AssetReservationStatus"
  END,
  roi."createdAt",
  roi."updatedAt",
  CASE
    WHEN ro."status" = 'DRAFT' THEN CURRENT_TIMESTAMP
    ELSE roi."deletedAt"
  END
FROM "RentalOrderItem" roi
JOIN "RentalOrder" ro ON ro."id" = roi."orderId"
WHERE roi."deletedAt" IS NULL
  AND roi."assetUnitId" IS NOT NULL
  AND ro."deletedAt" IS NULL
  AND ro."status" <> 'DRAFT';

CREATE UNIQUE INDEX "AssetReservation_orderItemId_key" ON "AssetReservation"("orderItemId");
CREATE INDEX "AssetReservation_assetUnitId_startDate_blockedEndDate_idx" ON "AssetReservation"("assetUnitId", "startDate", "blockedEndDate");
CREATE INDEX "AssetReservation_productId_startDate_blockedEndDate_idx" ON "AssetReservation"("productId", "startDate", "blockedEndDate");
CREATE INDEX "AssetReservation_status_startDate_blockedEndDate_idx" ON "AssetReservation"("status", "startDate", "blockedEndDate");
CREATE INDEX "AssetReservation_deletedAt_idx" ON "AssetReservation"("deletedAt");

ALTER TABLE "AssetReservation" ADD CONSTRAINT "AssetReservation_assetUnitId_fkey" FOREIGN KEY ("assetUnitId") REFERENCES "AssetUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetReservation" ADD CONSTRAINT "AssetReservation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "RentalOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetReservation" ADD CONSTRAINT "AssetReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RentalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetReservation" ADD CONSTRAINT "AssetReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssetReservation"
ADD CONSTRAINT "AssetReservation_no_asset_overlap"
EXCLUDE USING gist (
  "assetUnitId" WITH =,
  tsrange("startDate", "blockedEndDate", '[)') WITH &&
)
WHERE (
  "deletedAt" IS NULL
  AND "status" IN ('RESERVED', 'CHECKED_OUT')
);
