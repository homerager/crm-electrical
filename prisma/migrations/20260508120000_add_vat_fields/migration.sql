-- AddColumn: vatPercent to invoice_items
ALTER TABLE "invoice_items" ADD COLUMN "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AddColumn: vatPercent to purchase_request_items
ALTER TABLE "purchase_request_items" ADD COLUMN "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AddColumn: clientVatPercent to construction_objects
ALTER TABLE "construction_objects" ADD COLUMN "clientVatPercent" DECIMAL(5,2);

-- AddColumn: defaultVatPercent and defaultClientVatPercent to settings
ALTER TABLE "settings" ADD COLUMN "defaultVatPercent" DECIMAL(5,2);
ALTER TABLE "settings" ADD COLUMN "defaultClientVatPercent" DECIMAL(5,2);
