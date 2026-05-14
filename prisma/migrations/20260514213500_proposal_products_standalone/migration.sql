-- Migration: make proposal_products fully independent (no FK to products)
-- Also: proposal_items now references proposal_products instead of products

-- Step 1: drop old proposal_items FK to products and column productId
ALTER TABLE "proposal_items" DROP CONSTRAINT IF EXISTS "proposal_items_productId_fkey";
ALTER TABLE "proposal_items" DROP COLUMN IF EXISTS "productId";

-- Step 2: drop old proposal_products (was a price-overlay with FK to products)
ALTER TABLE "proposal_products" DROP CONSTRAINT IF EXISTS "proposal_products_productId_fkey";
DROP TABLE IF EXISTS "proposal_products";

-- Step 3: create standalone proposal_products catalog
CREATE TABLE "proposal_products" (
    "id"          TEXT          NOT NULL,
    "name"        TEXT          NOT NULL,
    "description" TEXT,
    "sku"         TEXT,
    "unit"        TEXT          NOT NULL DEFAULT 'шт',
    "groupName"   TEXT,
    "priceExVat"  DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatPercent"  DECIMAL(5,2)  NOT NULL DEFAULT 20,
    "notes"       TEXT,
    "sortOrder"   INTEGER       NOT NULL DEFAULT 0,
    "isActive"    BOOLEAN       NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "proposal_products_pkey" PRIMARY KEY ("id")
);

-- Step 4: add proposalProductId to proposal_items
ALTER TABLE "proposal_items"
    ADD COLUMN "proposalProductId" TEXT;

ALTER TABLE "proposal_items"
    ADD CONSTRAINT "proposal_items_proposalProductId_fkey"
    FOREIGN KEY ("proposalProductId") REFERENCES "proposal_products"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
