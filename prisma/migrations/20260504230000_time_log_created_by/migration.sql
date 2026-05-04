-- Хто створив запис часу (окремо від userId — на кого нараховані години)

ALTER TABLE "time_logs" ADD COLUMN "createdById" TEXT;

ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
