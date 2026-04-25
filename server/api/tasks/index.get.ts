export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const query = getQuery(event)
  const status = query.status as string | undefined
  const priority = query.priority as string | undefined
  const assignedToId = query.assignedToId as string | undefined
  const objectId = query.objectId as string | undefined

  const where: any = { parentId: null } // top-level only
  if (status) where.status = status
  if (priority) where.priority = priority
  if (assignedToId) where.assignedToId = assignedToId
  if (objectId) where.objectId = objectId

  const tasks = await prisma.task.findMany({
    where,
    include: {
      createdBy: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      object: { select: { id: true, name: true } },
      _count: { select: { timeLogs: true, comments: true, subTasks: true } },
      timeLogs: { select: { hours: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  return {
    tasks: tasks.map((t) => ({
      ...t,
      totalHours: t.timeLogs.reduce((sum, l) => sum + l.hours, 0),
    })),
  }
})
