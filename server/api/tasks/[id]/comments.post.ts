import { isEmptyCommentContent, sanitizeCommentHtml } from '../../../utils/commentHtml'
import {
  MAX_TASK_FILE_SIZE,
  createTaskAttachmentForComment,
} from '../../../utils/taskAttachmentFile'
import { sendEmail, buildTaskCommentEmail } from '../../../utils/email'

type BodyJson = { content: string; parentId?: string | null; attachmentIds?: string[] }

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const taskId = getRouterParam(event, 'id')!

  const contentType = (getRequestHeader(event, 'content-type') || '').toLowerCase()
  const isMultipart = contentType.includes('multipart/form-data')

  let rawContent = ''
  let parentId: string | null = null
  let attachmentIds: string[] = [] as string[]
  const fileBuffers: { filename: string; data: Buffer; mime: string }[] = []

  if (isMultipart) {
    const parts = await readMultipartFormData(event)
    if (parts) {
      for (const part of parts) {
        if (part.name === 'payload' && part.data) {
          try {
            const p = JSON.parse(part.data.toString('utf-8')) as BodyJson
            rawContent = p?.content ?? ''
            if (p?.parentId) parentId = String(p.parentId)
            if (Array.isArray(p?.attachmentIds)) attachmentIds = p.attachmentIds
          } catch {
            // ignore, validation below
          }
        } else if ((part.name === 'file' || part.name === 'files') && part.filename && part.data) {
          if (part.data.length > MAX_TASK_FILE_SIZE) {
            throw createError({ statusCode: 413, statusMessage: `Файл «${part.filename}» перевищує 100 МБ` })
          }
          fileBuffers.push({ filename: part.filename, data: part.data, mime: part.type ?? 'application/octet-stream' })
        }
      }
    }
  } else {
    const body = await readBody<BodyJson>(event)
    rawContent = body?.content ?? ''
    if (body?.parentId) parentId = String(body.parentId)
    if (Array.isArray(body?.attachmentIds)) attachmentIds = body.attachmentIds
  }

  const content = sanitizeCommentHtml(rawContent)
  if (isEmptyCommentContent(content)) {
    throw createError({ statusCode: 400, statusMessage: 'Коментар не може бути порожнім' })
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw createError({ statusCode: 404, statusMessage: 'Завдання не знайдено' })

  if (parentId) {
    const p = await prisma.taskComment.findFirst({ where: { id: parentId, taskId } })
    if (!p) {
      throw createError({ statusCode: 400, statusMessage: 'Повідомлення для відповіді не знайдено' })
    }
  }

  if (attachmentIds.length) {
    const mine = await prisma.taskAttachment.findMany({
      where: { id: { in: attachmentIds }, taskId, userId: auth.userId, commentId: null },
    })
    if (mine.length !== attachmentIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Некоректні або чужі вкладення' })
    }
  }

  const fullInclude = {
    user: { select: { id: true, name: true } as const },
    parent: { include: { user: { select: { id: true, name: true } } } },
    attachments: { include: { user: { select: { id: true, name: true } } } },
  } as const

  const out = await prisma.$transaction(async (tx) => {
    const created = await tx.taskComment.create({
      data: {
        taskId,
        userId: auth.userId,
        content,
        parentId,
      },
      include: fullInclude,
    })

    for (const fb of fileBuffers) {
      await createTaskAttachmentForComment(tx, {
        taskId,
        userId: auth.userId,
        filename: fb.filename,
        data: fb.data,
        mimeType: fb.mime,
        commentId: created.id,
      })
    }

    if (attachmentIds.length) {
      await tx.taskAttachment.updateMany({
        where: { id: { in: attachmentIds }, taskId, userId: auth.userId, commentId: null },
        data: { commentId: created.id },
      })
    }

    return tx.taskComment.findFirstOrThrow({
      where: { id: created.id },
      include: fullInclude,
    })
  })

  const recipients = new Set<string>()
  if (task.createdById && task.createdById !== auth.userId) recipients.add(task.createdById)
  if (task.assignedToId && task.assignedToId !== auth.userId) recipients.add(task.assignedToId)

  if (recipients.size) {
    const commenter = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true },
    })
    const commenterName = commenter?.name ?? 'Користувач'

    createNotificationForMany([...recipients], {
      title: `Коментар до завдання: ${task.title}`,
      body: `${commenterName} залишив коментар`,
      link: `/tasks/${taskId}`,
    })

    const config = useRuntimeConfig()
    const { subject, html } = buildTaskCommentEmail(task, commenterName, config.appUrl)
    const emailUsers = await prisma.user.findMany({
      where: { id: { in: [...recipients] } },
      select: { email: true, emailNotifications: true },
    })
    for (const u of emailUsers) {
      if (u.email && u.emailNotifications) sendEmail(u.email, subject, html)
    }
  }

  return out
})
