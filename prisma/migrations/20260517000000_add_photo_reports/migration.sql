-- CreateEnum
CREATE TYPE "PhotoStage" AS ENUM ('BEFORE', 'IN_PROGRESS', 'AFTER');

-- CreateTable
CREATE TABLE "photo_reports" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_report_photos" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "stage" "PhotoStage" NOT NULL DEFAULT 'BEFORE',
    "description" TEXT,
    "filename" TEXT NOT NULL,
    "storedAs" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "takenAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_report_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "photo_reports_objectId_idx" ON "photo_reports"("objectId");

-- CreateIndex
CREATE INDEX "photo_reports_createdById_idx" ON "photo_reports"("createdById");

-- CreateIndex
CREATE INDEX "photo_report_photos_reportId_stage_idx" ON "photo_report_photos"("reportId", "stage");

-- AddForeignKey
ALTER TABLE "photo_reports" ADD CONSTRAINT "photo_reports_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "construction_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_reports" ADD CONSTRAINT "photo_reports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_report_photos" ADD CONSTRAINT "photo_report_photos_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "photo_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
