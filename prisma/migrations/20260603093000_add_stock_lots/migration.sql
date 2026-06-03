-- Stock lots by supplier + price
-- A stock record becomes a "lot" keyed by (warehouse/object, product, contractor, pricePerUnit).
-- Existing rows become a single legacy lot (contractorId = NULL, pricePerUnit = weighted-average
-- unit price from past INCOMING invoices, else 0). minStock / lowStockNotifiedAt move to a new
-- product-level WarehouseProductSetting table.

-- 1. Add lot columns (keep legacy minStock/lowStockNotifiedAt for now so we can backfill from them)
ALTER TABLE "warehouse_stock"
  ADD COLUMN "contractorId" TEXT,
  ADD COLUMN "pricePerUnit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE "object_stock"
  ADD COLUMN "contractorId" TEXT,
  ADD COLUMN "pricePerUnit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE "movement_items"
  ADD COLUMN "contractorId" TEXT,
  ADD COLUMN "pricePerUnit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- 2. Backfill pricePerUnit on existing legacy lots from weighted-average of INCOMING invoices.
--    Warehouse lots: weighted average per (product, warehouse).
UPDATE "warehouse_stock" ws
SET "pricePerUnit" = sub.avg_price
FROM (
  SELECT ii."productId" AS "productId",
         inv."warehouseId" AS "warehouseId",
         SUM(ii."quantity" * ii."pricePerUnit") / NULLIF(SUM(ii."quantity"), 0) AS avg_price
  FROM "invoice_items" ii
  JOIN "invoices" inv ON inv."id" = ii."invoiceId"
  WHERE inv."type" = 'INCOMING' AND inv."warehouseId" IS NOT NULL
  GROUP BY ii."productId", inv."warehouseId"
) sub
WHERE ws."productId" = sub."productId"
  AND ws."warehouseId" = sub."warehouseId"
  AND sub.avg_price IS NOT NULL;

--    Object lots: object stock has no direct warehouse link, so use the weighted average per product
--    across all INCOMING invoices as the best available approximation.
UPDATE "object_stock" os
SET "pricePerUnit" = sub.avg_price
FROM (
  SELECT ii."productId" AS "productId",
         SUM(ii."quantity" * ii."pricePerUnit") / NULLIF(SUM(ii."quantity"), 0) AS avg_price
  FROM "invoice_items" ii
  JOIN "invoices" inv ON inv."id" = ii."invoiceId"
  WHERE inv."type" = 'INCOMING'
  GROUP BY ii."productId"
) sub
WHERE os."productId" = sub."productId"
  AND sub.avg_price IS NOT NULL;

-- 3. Create the product-level settings table.
CREATE TABLE "warehouse_product_settings" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "minStock" DECIMAL(12,3),
    "lowStockNotifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_product_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "warehouse_product_settings_warehouseId_productId_key" ON "warehouse_product_settings"("warehouseId", "productId");

-- 4. Backfill settings from existing per-row minStock / lowStockNotifiedAt.
--    (warehouse_stock is still unique per (productId, warehouseId) at this point, so no conflicts.)
INSERT INTO "warehouse_product_settings" ("id", "warehouseId", "productId", "minStock", "lowStockNotifiedAt", "updatedAt")
SELECT 'wps_' || ws."id", ws."warehouseId", ws."productId", ws."minStock", ws."lowStockNotifiedAt", CURRENT_TIMESTAMP
FROM "warehouse_stock" ws
WHERE ws."minStock" IS NOT NULL OR ws."lowStockNotifiedAt" IS NOT NULL;

-- 5. Drop legacy columns now that settings are migrated.
ALTER TABLE "warehouse_stock"
  DROP COLUMN "minStock",
  DROP COLUMN "lowStockNotifiedAt";

-- 6. Swap unique constraints to the new lot keys and add lookup indexes.
DROP INDEX "warehouse_stock_productId_warehouseId_key";
DROP INDEX "object_stock_objectId_productId_key";

CREATE INDEX "warehouse_stock_warehouseId_productId_idx" ON "warehouse_stock"("warehouseId", "productId");
CREATE UNIQUE INDEX "warehouse_stock_warehouseId_productId_contractorId_pricePer_key" ON "warehouse_stock"("warehouseId", "productId", "contractorId", "pricePerUnit");

CREATE INDEX "object_stock_objectId_productId_idx" ON "object_stock"("objectId", "productId");
CREATE UNIQUE INDEX "object_stock_objectId_productId_contractorId_pricePerUnit_key" ON "object_stock"("objectId", "productId", "contractorId", "pricePerUnit");

-- 7. Foreign keys for the new contractor references.
ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "object_stock" ADD CONSTRAINT "object_stock_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "movement_items" ADD CONSTRAINT "movement_items_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "warehouse_product_settings" ADD CONSTRAINT "warehouse_product_settings_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_product_settings" ADD CONSTRAINT "warehouse_product_settings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
