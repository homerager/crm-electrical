-- CreateTable
CREATE TABLE "warehouse_object_reservations" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_object_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "warehouse_object_reservations_objectId_warehouseId_productId_key" ON "warehouse_object_reservations"("objectId", "warehouseId", "productId");

ALTER TABLE "warehouse_object_reservations" ADD CONSTRAINT "warehouse_object_reservations_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "construction_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warehouse_object_reservations" ADD CONSTRAINT "warehouse_object_reservations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warehouse_object_reservations" ADD CONSTRAINT "warehouse_object_reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
