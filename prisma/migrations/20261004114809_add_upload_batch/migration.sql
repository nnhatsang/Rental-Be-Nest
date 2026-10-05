-- CreateEnum
CREATE TYPE "UploadBatchStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED', 'FAILED', 'EXPIRED');

-- AlterTable
ALTER TABLE "FileObject" ADD COLUMN     "uploadBatchId" UUID;

-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" UUID NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "status" "UploadBatchStatus" NOT NULL DEFAULT 'OPEN',
    "expectedFileCount" INTEGER NOT NULL,
    "expectedTotalBytes" BIGINT NOT NULL,
    "uploadedBy" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadBatch_uploadedBy_status_createdAt_idx" ON "UploadBatch"("uploadedBy", "status", "createdAt");

-- CreateIndex
CREATE INDEX "UploadBatch_status_expiresAt_idx" ON "UploadBatch"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "FileObject_uploadBatchId_idx" ON "FileObject"("uploadBatchId");

-- AddForeignKey
ALTER TABLE "FileObject" ADD CONSTRAINT "FileObject_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
