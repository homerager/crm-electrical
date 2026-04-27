import { unlink } from 'node:fs/promises'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const taskId = getRouterParam(event, 'id')!
  const commentId = getRouterParam(event, 'commentId')!

  const existing = await prisma.taskComment.findFirst({ where: { id: commentId, taskId } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Коментар не знайдено' })
  }

  if (existing.userId !== auth.userId && auth.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Немає прав на видалення' })
  }

  const replyCount = await prisma.taskComment.count({ where: { parentId: commentId } })
  if (replyCount > 0) {
    throw createError({ statusCode: 400, statusMessage: 'Спочатку видаліть відповіді' })
  }

  const toDelete = await prisma.taskAttachment.findMany({ where: { commentId } })
  for (const att of toDelete) {
    try {
      await unlink(join(process.cwd(), 'public', 'uploads', 'tasks', att.storedAs))
    } catch {
      // file missing
    }
  }

  await prisma.taskComment.delete({ where: { id: commentId } })

  return { ok: true }
})
