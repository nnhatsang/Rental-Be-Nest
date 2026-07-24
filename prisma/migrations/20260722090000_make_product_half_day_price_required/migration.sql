UPDATE "Product"
SET "halfDayPrice" = "dailyPrice"
WHERE "halfDayPrice" IS NULL;

ALTER TABLE "Product"
ALTER COLUMN "halfDayPrice" SET NOT NULL;
