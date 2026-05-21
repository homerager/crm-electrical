-- AlterTable
ALTER TABLE "construction_objects" ADD COLUMN "projectId" TEXT;

-- AddForeignKey
ALTER TABLE "construction_objects" ADD CONSTRAINT "construction_objects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
