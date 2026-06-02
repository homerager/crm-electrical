-- AlterTable
ALTER TABLE "products" ADD COLUMN "barcode" TEXT;

-- CreateTable
CREATE TABLE "material_inventory_sessions" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "InventorySessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "material_inventory_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_inventory_items" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "countedQty" DECIMAL(12,3),
    "scannedAt" TIMESTAMP(3),

    CONSTRAINT "material_inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "material_inventory_sessions_warehouseId_idx" ON "material_inventory_sessions"("warehouseId");

-- CreateIndex
CREATE INDEX "material_inventory_sessions_status_idx" ON "material_inventory_sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "material_inventory_items_sessionId_productId_key" ON "material_inventory_items"("sessionId", "productId");

-- AddForeignKey
ALTER TABLE "material_inventory_sessions" ADD CONSTRAINT "material_inventory_sessions_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_inventory_sessions" ADD CONSTRAINT "material_inventory_sessions_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_inventory_items" ADD CONSTRAINT "material_inventory_items_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "material_inventory_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_inventory_items" ADD CONSTRAINT "material_inventory_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
