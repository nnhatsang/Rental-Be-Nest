BEGIN;

CREATE TYPE "FilePurpose" AS ENUM (
    'INSPECTION',
    'INCIDENT',
    'PAYMENT_PROOF',
    'PRODUCT_MEDIA',
    'ASSET_MEDIA',
    'DELIVERY_PROOF',
    'CONTRACT_DOCUMENT',
    'CONTRIBUTOR_DOCUMENT',
    'REPORT_EXPORT',
    'CMS_MEDIA'
);

CREATE TYPE "FileObjectStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'READY',
    'FAILED',
    'DELETED'
);

CREATE TYPE "FileVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

CREATE TYPE "FileObjectEventType" AS ENUM (
    'PRESIGNED',
    'UPLOAD_COMPLETED',
    'DOWNLOAD_URL_ISSUED',
    'DELETED',
    'FAILED'
);

CREATE TABLE "FileObject" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'R2',
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "status" "FileObjectStatus" NOT NULL DEFAULT 'PENDING',
    "visibility" "FileVisibility" NOT NULL DEFAULT 'PRIVATE',
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "etag" TEXT,
    "uploadedBy" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FileObjectEvent" (
    "id" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "actorId" UUID,
    "event" "FileObjectEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileObjectEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FileObject_objectKey_key" ON "FileObject"("objectKey");
CREATE INDEX "FileObject_purpose_status_createdAt_idx" ON "FileObject"("purpose", "status", "createdAt");
CREATE INDEX "FileObject_uploadedBy_createdAt_idx" ON "FileObject"("uploadedBy", "createdAt");
CREATE INDEX "FileObject_status_expiresAt_idx" ON "FileObject"("status", "expiresAt");
CREATE INDEX "FileObject_deletedAt_idx" ON "FileObject"("deletedAt");
CREATE INDEX "FileObjectEvent_fileId_createdAt_idx" ON "FileObjectEvent"("fileId", "createdAt");
CREATE INDEX "FileObjectEvent_actorId_createdAt_idx" ON "FileObjectEvent"("actorId", "createdAt");
CREATE INDEX "FileObjectEvent_event_createdAt_idx" ON "FileObjectEvent"("event", "createdAt");

ALTER TABLE "FileObject"
    ADD CONSTRAINT "FileObject_uploadedBy_fkey"
    FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FileObjectEvent"
    ADD CONSTRAINT "FileObjectEvent_fileId_fkey"
    FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FileObjectEvent"
    ADD CONSTRAINT "FileObjectEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
