-- Availability discovery frequently filters blocking orders by status and time overlap,
-- then joins rental order items by product or asset unit.
CREATE INDEX "RentalOrder_status_startDate_blockedEndDate_deletedAt_idx"
ON "RentalOrder"("status", "startDate", "blockedEndDate", "deletedAt");

CREATE INDEX "RentalOrderItem_productId_deletedAt_idx"
ON "RentalOrderItem"("productId", "deletedAt");

CREATE INDEX "RentalOrderItem_assetUnitId_deletedAt_idx"
ON "RentalOrderItem"("assetUnitId", "deletedAt");
