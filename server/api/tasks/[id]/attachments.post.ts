import { MAX_TASK_FILE_SIZE, buildStoredFileName, writeTaskFileBuffer } from '../../../utils/taskAttachmentFile'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const taskId = getRouterParam(event, 'id')!

  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw createError({ statusCode: 404, statusMessage: 'Завдання не знайдено' })

  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Файл не отримано' })
  }

  const results = []

  for (const part of parts) {
    if (!part.filename || !part.data) continue

    if (part.data.length > MAX_TASK_FILE_SIZE) {
      throw createError({ statusCode: 413, statusMessage: `Файл "${part.filename}" перевищує ліміт 100 МБ` })
    }

    const storedAs = buildStoredFileName(part.filename)
    await writeTaskFileBuffer(storedAs, part.data)

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        userId: auth.userId,
        filename: part.filename,
        storedAs,
        mimeType: part.type ?? 'application/octet-stream',
        size: part.data.length,
      },
      include: { user: { select: { id: true, name: true } } },
    })

    results.push(attachment)
  }

  return { attachments: results }
})
