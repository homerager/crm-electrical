-- AlterEnum
ALTER TYPE "MovementType" ADD VALUE 'OBJECT_WRITE_OFF';
ALTER TYPE "MovementType" ADD VALUE 'OBJECT_TO_WAREHOUSE';

-- CreateTable
CREATE TABLE "object_stock" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "object_stock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "object_stock_objectId_productId_key" ON "object_stock"("objectId", "productId");

ALTER TABLE "object_stock" ADD CONSTRAINT "object_stock_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "construction_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "object_stock" ADD CONSTRAINT "object_stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "movements" ALTER COLUMN "fromWarehouseId" DROP NOT NULL;

-- Backfill залишків на обʼєкті з історичних відпусків (до появи object_stock)
INSERT INTO "object_stock" ("id", "objectId", "productId", "quantity", "updatedAt")
SELECT gen_random_uuid()::text,
       agg."objectId",
       agg."productId",
       agg.total_qty,
       CURRENT_TIMESTAMP
FROM (
    SELECT m."objectId",
           mi."productId",
           SUM(mi."quantity") AS total_qty
    FROM "movements" m
    INNER JOIN "movement_items" mi ON mi."movementId" = m.id
    WHERE m.type = 'WAREHOUSE_TO_OBJECT'
      AND m."objectId" IS NOT NULL
    GROUP BY m."objectId", mi."productId"
) agg;
