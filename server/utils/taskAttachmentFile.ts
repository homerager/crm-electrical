import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'

export const MAX_TASK_FILE_SIZE = 100 * 1024 * 1024 // 100 MB

function extensionFromFilename(name: string) {
  if (!name.includes('.')) return ''
  return name.split('.').pop()!.toLowerCase()
}

export function buildStoredFileName(originalFilename: string) {
  const ext = extensionFromFilename(originalFilename)
  return `${randomUUID()}${ext ? `.${ext}` : ''}`
}

export async function writeTaskFileBuffer(storedAs: string, data: Buffer) {
  const uploadDir = join(process.cwd(), 'public', 'uploads', 'tasks')
  await mkdir(uploadDir, { recursive: true })
  await writeFile(join(uploadDir, storedAs), data)
}

export async function createTaskAttachmentForComment(
  tx: Prisma.TransactionClient,
  input: {
    taskId: string
    userId: string
    filename: string
    data: Buffer
    mimeType: string
    commentId: string
  }
) {
  if (input.data.length > MAX_TASK_FILE_SIZE) {
    throw new Error('FILE_TOO_LARGE')
  }
  const storedAs = buildStoredFileName(input.filename)
  await writeTaskFileBuffer(storedAs, input.data)

  return tx.taskAttachment.create({
    data: {
      taskId: input.taskId,
      userId: input.userId,
      commentId: input.commentId,
      filename: input.filename,
      storedAs,
      mimeType: input.mimeType || 'application/octet-stream',
      size: input.data.length,
    },
    include: { user: { select: { id: true, name: true } } },
  })
}
