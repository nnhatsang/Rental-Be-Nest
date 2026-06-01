-- CreateEnum
CREATE TYPE "UserActivityStatus" AS ENUM ('ACTIVE', 'BANNED', 'LOCKED', 'INACTIVE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "activityStatus" "UserActivityStatus" NOT NULL DEFAULT 'ACTIVE';

-- Backfill existing boolean status into the new activity status.
UPDATE "User"
SET "activityStatus" = CASE
    WHEN "isActive" = true THEN 'ACTIVE'::"UserActivityStatus"
    ELSE 'INACTIVE'::"UserActivityStatus"
END;

-- DropIndex
DROP INDEX IF EXISTS "User_isActive_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isActive";

-- CreateIndex
CREATE INDEX "User_activityStatus_idx" ON "User"("activityStatus");
