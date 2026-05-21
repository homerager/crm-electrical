-- AlterTable
ALTER TABLE "time_logs" ADD COLUMN "warehouseId" TEXT;

-- AddForeignKey
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
