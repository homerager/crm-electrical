import { isEmptyCommentContent, sanitizeCommentHtml } from '../../../../utils/commentHtml'

type Body = { content: string; attachmentIds?: string[] }

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const taskId = getRouterParam(event, 'id')!
  const commentId = getRouterParam(event, 'commentId')!
  const body = await readBody<Body>(event)

  const content = sanitizeCommentHtml(body?.content ?? '')
  if (isEmptyCommentContent(content)) {
    throw createError({ statusCode: 400, statusMessage: 'Коментар не може бути порожнім' })
  }

  const existing = await prisma.taskComment.findFirst({ where: { id: commentId, taskId } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Коментар не знайдено' })
  }

  if (existing.userId !== auth.userId && auth.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Немає прав на редагування' })
  }

  const newIds = Array.isArray(body?.attachmentIds) ? body.attachmentIds : []
  if (newIds.length) {
    const mine = await prisma.taskAttachment.findMany({
      where: { id: { in: newIds }, taskId, userId: auth.userId, commentId: null },
    })
    if (mine.length !== newIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Некоректні або чужі вкладення' })
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.taskComment.update({
      where: { id: commentId },
      data: { content },
    })
    if (newIds.length) {
      await tx.taskAttachment.updateMany({
        where: { id: { in: newIds }, taskId, userId: auth.userId, commentId: null },
        data: { commentId },
      })
    }
  })

  return prisma.taskComment.findFirstOrThrow({
    where: { id: commentId },
    include: {
      user: { select: { id: true, name: true } },
      parent: { include: { user: { select: { id: true, name: true } } } },
      attachments: { include: { user: { select: { id: true, name: true } } } },
    },
  })
})
