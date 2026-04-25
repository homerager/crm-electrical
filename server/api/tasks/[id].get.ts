export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      object: { select: { id: true, name: true } },
      timeLogs: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { date: 'desc' },
      },
      comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      attachments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      parent: { select: { id: true, title: true, status: true } },
      subTasks: {
        include: {
          assignee: { select: { id: true, name: true } },
          _count: { select: { subTasks: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!task) throw createError({ statusCode: 404, statusMessage: 'Завдання не знайдено' })

  const totalHours = task.timeLogs.reduce((sum, l) => sum + l.hours, 0)

  return { ...task, totalHours }
})
