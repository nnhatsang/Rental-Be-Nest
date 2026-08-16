CREATE TABLE "RentalOrderLog" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "actorId" UUID,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "changes" JSONB NOT NULL,
  "note" TEXT,
  "actorSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RentalOrderLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RentalOrderLog_orderId_idx" ON "RentalOrderLog"("orderId");
CREATE INDEX "RentalOrderLog_actorId_idx" ON "RentalOrderLog"("actorId");
CREATE INDEX "RentalOrderLog_action_idx" ON "RentalOrderLog"("action");
CREATE INDEX "RentalOrderLog_createdAt_idx" ON "RentalOrderLog"("createdAt");

ALTER TABLE "RentalOrderLog"
ADD CONSTRAINT "RentalOrderLog_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "RentalOrder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
