-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ESTIMATE', 'ACT', 'CONTRACT');

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "objectId" TEXT,
    "clientId" TEXT,
    "data" JSONB NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "documents_objectId_idx" ON "documents"("objectId");

-- CreateIndex
CREATE INDEX "documents_createdById_idx" ON "documents"("createdById");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "construction_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
