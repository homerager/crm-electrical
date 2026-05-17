-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('WORK', 'DAY_OFF', 'VACATION', 'SICK_LEAVE', 'BIRTHDAY');

-- CreateEnum
CREATE TYPE "ScheduleShift" AS ENUM ('FULL_DAY', 'MORNING', 'AFTERNOON');

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "objectId" TEXT,
    "date" DATE NOT NULL,
    "type" "ScheduleType" NOT NULL DEFAULT 'WORK',
    "shift" "ScheduleShift" NOT NULL DEFAULT 'FULL_DAY',
    "hours" DOUBLE PRECISION,
    "timeLogId" TEXT,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedules_timeLogId_key" ON "schedules"("timeLogId");

-- CreateIndex
CREATE INDEX "schedules_objectId_idx" ON "schedules"("objectId");

-- CreateIndex
CREATE INDEX "schedules_date_idx" ON "schedules"("date");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_userId_date_shift_key" ON "schedules"("userId", "date", "shift");

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "construction_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_timeLogId_fkey" FOREIGN KEY ("timeLogId") REFERENCES "time_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
