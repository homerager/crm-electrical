export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const taskId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { content } = body

  if (!content?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Коментар не може бути порожнім' })
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw createError({ statusCode: 404, statusMessage: 'Завдання не знайдено' })

  const comment = await prisma.taskComment.create({
    data: {
      taskId,
      userId: auth.userId,
      content: content.trim(),
    },
    include: { user: { select: { id: true, name: true } } },
  })

  return comment
})
