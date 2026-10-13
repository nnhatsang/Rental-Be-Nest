ALTER TABLE "PaymentTransaction"
ADD COLUMN "proofFileId" UUID;

CREATE INDEX "PaymentTransaction_status_method_createdAt_idx"
ON "PaymentTransaction"("status", "method", "createdAt");

ALTER TABLE "PaymentTransaction"
ADD CONSTRAINT "PaymentTransaction_proofFileId_fkey"
FOREIGN KEY ("proofFileId") REFERENCES "FileObject"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
