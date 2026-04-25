import { unlink } from 'node:fs/promises'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!

  const attachment = await prisma.taskAttachment.findUnique({ where: { id } })
  if (!attachment) throw createError({ statusCode: 404, statusMessage: 'Файл не знайдено' })

  if (attachment.userId !== auth.userId && auth.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Недостатньо прав' })
  }

  // Remove physical file
  try {
    const filePath = join(process.cwd(), 'public', 'uploads', 'tasks', attachment.storedAs)
    await unlink(filePath)
  } catch {
    // ignore if file already removed
  }

  await prisma.taskAttachment.delete({ where: { id } })

  return { ok: true }
})
