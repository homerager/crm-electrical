-- AddColumn: user opt-in for low-stock notifications
ALTER TABLE "users" ADD COLUMN "lowStockNotifications" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn: per-product minimum stock per warehouse + last-notified timestamp for dedup
ALTER TABLE "warehouse_stock" ADD COLUMN "minStock" DECIMAL(12,3);
ALTER TABLE "warehouse_stock" ADD COLUMN "lowStockNotifiedAt" TIMESTAMP(3);
