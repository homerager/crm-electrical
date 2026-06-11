-- CreateTable
CREATE TABLE "electrical_panels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "objectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "electrical_panels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electrical_panel_materials" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'шт',
    "quantity" DECIMAL(12,3) NOT NULL,
    "contractorId" TEXT,
    "pricePerUnit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "writtenOff" BOOLEAN NOT NULL DEFAULT false,
    "movementId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "electrical_panel_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "electrical_panels_objectId_idx" ON "electrical_panels"("objectId");

-- CreateIndex
CREATE INDEX "electrical_panels_createdById_idx" ON "electrical_panels"("createdById");

-- CreateIndex
CREATE INDEX "electrical_panel_materials_panelId_idx" ON "electrical_panel_materials"("panelId");

-- AddForeignKey
ALTER TABLE "electrical_panels" ADD CONSTRAINT "electrical_panels_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "construction_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electrical_panels" ADD CONSTRAINT "electrical_panels_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electrical_panel_materials" ADD CONSTRAINT "electrical_panel_materials_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "electrical_panels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electrical_panel_materials" ADD CONSTRAINT "electrical_panel_materials_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electrical_panel_materials" ADD CONSTRAINT "electrical_panel_materials_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electrical_panel_materials" ADD CONSTRAINT "electrical_panel_materials_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
