-- Store two identity images and a lightweight review status on each rental order.
ALTER TYPE "FilePurpose" ADD VALUE 'CUSTOMER_IDENTITY';

CREATE TYPE "RentalIdentityDocumentType" AS ENUM ('CITIZEN_ID', 'DRIVER_LICENSE', 'PASSPORT');

CREATE TYPE "RentalIdentityReviewStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');

ALTER TABLE "RentalOrder"
ADD COLUMN "identityDocumentType" "RentalIdentityDocumentType",
ADD COLUMN "identityFrontFileId" UUID,
ADD COLUMN "identityBackFileId" UUID,
ADD COLUMN "identityReviewStatus" "RentalIdentityReviewStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN "identityReviewNote" TEXT;

CREATE INDEX "RentalOrder_identityReviewStatus_startDate_deletedAt_idx"
ON "RentalOrder"("identityReviewStatus", "startDate", "deletedAt");

ALTER TABLE "RentalOrder"
ADD CONSTRAINT "RentalOrder_identityFrontFileId_fkey"
FOREIGN KEY ("identityFrontFileId") REFERENCES "FileObject"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RentalOrder"
ADD CONSTRAINT "RentalOrder_identityBackFileId_fkey"
FOREIGN KEY ("identityBackFileId") REFERENCES "FileObject"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
