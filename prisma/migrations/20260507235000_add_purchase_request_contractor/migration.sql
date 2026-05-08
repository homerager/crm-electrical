-- AlterTable
ALTER TABLE "purchase_requests" ADD COLUMN "contractorId" TEXT;

-- CreateIndex
CREATE INDEX "purchase_requests_contractorId_idx" ON "purchase_requests"("contractorId");

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
