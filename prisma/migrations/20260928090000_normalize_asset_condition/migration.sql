-- Normalize legacy data before removing the duplicate LOST condition.
-- A lost unit is operationally unavailable; its physical condition is kept as the last known non-lost value.
BEGIN;

UPDATE "AssetUnit"
SET "status" = 'LOST',
    "condition" = 'GOOD'
WHERE "condition" = 'LOST';

CREATE TYPE "AssetCondition_new" AS ENUM ('NEW', 'GOOD', 'FAIR', 'DAMAGED');
ALTER TABLE "public"."AssetUnit" ALTER COLUMN "condition" DROP DEFAULT;
ALTER TABLE "AssetUnit"
  ALTER COLUMN "condition" TYPE "AssetCondition_new"
  USING ("condition"::text::"AssetCondition_new");
ALTER TYPE "AssetCondition" RENAME TO "AssetCondition_old";
ALTER TYPE "AssetCondition_new" RENAME TO "AssetCondition";
DROP TYPE "public"."AssetCondition_old";
ALTER TABLE "AssetUnit" ALTER COLUMN "condition" SET DEFAULT 'GOOD';

COMMIT;