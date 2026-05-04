import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'
import { sendStream, setResponseHeader } from 'h3'
import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const id = getRouterParam(event, 'id')!
  const isElevated = isElevatedRole(auth.role)

  const attachment = await prisma.taskAttachment.findUnique({
    where: { id },
    include: { task: { select: { projectId: true } } },
  })

  if (!attachment) {
    throw createError({ statusCode: 404, statusMessage: 'Файл не знайдено' })
  }

  if (!isElevated && attachment.task.projectId) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: attachment.task.projectId, userId: auth.userId } },
    })
    if (!member) throw createError({ statusCode: 403, statusMessage: 'Доступ заборонено' })
  }

  const filePath = join(process.cwd(), 'public', 'uploads', 'tasks', attachment.storedAs)
  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: 'Файл втрачено на диску' })
  }

  setResponseHeader(event, 'content-type', attachment.mimeType)
  setResponseHeader(
    event,
    'content-disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
  )
  setResponseHeader(event, 'cache-control', 'private, no-cache')

  return sendStream(event, createReadStream(filePath))
})
