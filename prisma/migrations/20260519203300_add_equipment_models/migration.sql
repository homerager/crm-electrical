-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('IN_STOCK', 'INSTALLED', 'IN_REPAIR', 'DECOMMISSIONED', 'IN_TRANSIT');

-- CreateEnum
CREATE TYPE "InventorySessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "serialNumber" TEXT,
    "barcode" TEXT,
    "qrCodeUrl" TEXT,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'IN_STOCK',
    "currentWarehouseId" TEXT,
    "currentObjectId" TEXT,
    "responsibleUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_movements" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "fromWarehouseId" TEXT,
    "fromObjectId" TEXT,
    "toWarehouseId" TEXT,
    "toObjectId" TEXT,
    "reason" TEXT,
    "photoUrl" TEXT,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_status_logs" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "oldStatus" "EquipmentStatus" NOT NULL,
    "newStatus" "EquipmentStatus" NOT NULL,
    "reason" TEXT,
    "photoUrl" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_sessions" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT,
    "objectId" TEXT,
    "status" "InventorySessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_session_items" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "found" BOOLEAN NOT NULL DEFAULT false,
    "scannedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_session_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_barcode_key" ON "equipment"("barcode");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- CreateIndex
CREATE INDEX "equipment_currentWarehouseId_idx" ON "equipment"("currentWarehouseId");

-- CreateIndex
CREATE INDEX "equipment_currentObjectId_idx" ON "equipment"("currentObjectId");

-- CreateIndex
CREATE INDEX "equipment_movements_equipmentId_idx" ON "equipment_movements"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_movements_performedById_idx" ON "equipment_movements"("performedById");

-- CreateIndex
CREATE INDEX "equipment_status_logs_equipmentId_idx" ON "equipment_status_logs"("equipmentId");

-- CreateIndex
CREATE INDEX "inventory_sessions_warehouseId_idx" ON "inventory_sessions"("warehouseId");

-- CreateIndex
CREATE INDEX "inventory_sessions_objectId_idx" ON "inventory_sessions"("objectId");

-- CreateIndex
CREATE INDEX "inventory_sessions_status_idx" ON "inventory_sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_session_items_sessionId_equipmentId_key" ON "inventory_session_items"("sessionId", "equipmentId");

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_currentWarehouseId_fkey" FOREIGN KEY ("currentWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_currentObjectId_fkey" FOREIGN KEY ("currentObjectId") REFERENCES "construction_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_movements" ADD CONSTRAINT "equipment_movements_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_movements" ADD CONSTRAINT "equipment_movements_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_movements" ADD CONSTRAINT "equipment_movements_fromObjectId_fkey" FOREIGN KEY ("fromObjectId") REFERENCES "construction_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_movements" ADD CONSTRAINT "equipment_movements_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_movements" ADD CONSTRAINT "equipment_movements_toObjectId_fkey" FOREIGN KEY ("toObjectId") REFERENCES "construction_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_movements" ADD CONSTRAINT "equipment_movements_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_status_logs" ADD CONSTRAINT "equipment_status_logs_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_status_logs" ADD CONSTRAINT "equipment_status_logs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_sessions" ADD CONSTRAINT "inventory_sessions_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_sessions" ADD CONSTRAINT "inventory_sessions_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "construction_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_sessions" ADD CONSTRAINT "inventory_sessions_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_session_items" ADD CONSTRAINT "inventory_session_items_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "inventory_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_session_items" ADD CONSTRAINT "inventory_session_items_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
