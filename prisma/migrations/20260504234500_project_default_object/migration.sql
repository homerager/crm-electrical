-- AlterTable
ALTER TABLE "projects" ADD COLUMN "defaultObjectId" TEXT;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_defaultObjectId_fkey" FOREIGN KEY ("defaultObjectId") REFERENCES "construction_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
