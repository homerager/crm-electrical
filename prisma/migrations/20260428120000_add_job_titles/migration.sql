-- CreateTable
CREATE TABLE "job_titles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_titles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_titles_name_key" ON "job_titles"("name");

-- AlterTable
ALTER TABLE "users" ADD COLUMN "jobTitleId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_jobTitleId_fkey" FOREIGN KEY ("jobTitleId") REFERENCES "job_titles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
