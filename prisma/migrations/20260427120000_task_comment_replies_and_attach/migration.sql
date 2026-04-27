-- AlterTable
ALTER TABLE "task_attachments" ADD COLUMN     "commentId" TEXT;

-- AlterTable
ALTER TABLE "task_comments" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "task_attachments_commentId_idx" ON "task_attachments"("commentId");

-- CreateIndex
CREATE INDEX "task_comments_parentId_idx" ON "task_comments"("parentId");

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "task_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "task_comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
