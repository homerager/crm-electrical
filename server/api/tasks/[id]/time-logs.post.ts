export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const taskId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { hours, description, date } = body

  if (!hours || Number(hours) <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Кількість годин має бути більше 0' })
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw createError({ statusCode: 404, statusMessage: 'Завдання не знайдено' })

  const log = await prisma.timeLog.create({
    data: {
      taskId,
      userId: auth.userId,
      hours: Number(hours),
      description: description?.trim() || null,
      date: date ? new Date(date) : new Date(),
    },
    include: { user: { select: { id: true, name: true } } },
  })

  return log
})
