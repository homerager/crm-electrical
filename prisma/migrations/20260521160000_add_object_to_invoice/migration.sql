-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "warehouseId" DROP NOT NULL;

-- AddColumn
ALTER TABLE "invoices" ADD COLUMN "objectId" TEXT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "construction_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
