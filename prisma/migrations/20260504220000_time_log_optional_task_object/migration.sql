-- Optional task + optional object on time logs (manual / manager entries)

ALTER TABLE "time_logs" DROP CONSTRAINT "time_logs_taskId_fkey";

ALTER TABLE "time_logs" ADD COLUMN "objectId" TEXT;

ALTER TABLE "time_logs" ALTER COLUMN "taskId" DROP NOT NULL;

ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "construction_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "time_logs" tl
SET "objectId" = t."objectId"
FROM "tasks" t
WHERE tl."taskId" = t."id" AND t."objectId" IS NOT NULL;
