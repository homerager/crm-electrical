export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (auth.role === 'USER') {
    throw createError({ statusCode: 403, statusMessage: 'Недостатньо прав' })
  }

  const query = getQuery(event)
  const from = query.from ? new Date(query.from as string) : undefined
  const to = query.to ? new Date(query.to as string) : undefined

  const dateFilter = from || to
    ? { date: { ...(from && { gte: from }), ...(to && { lte: to }) } }
    : {}

  const timeLogWhere = {
    ...dateFilter,
    OR: [{ task: { status: 'DONE' as const } }, { taskId: null, objectId: { not: null } }],
  }

  const [tasksByStatus, tasksByPriority, timeByUser, recentTimeLogs] = await Promise.all([
    prisma.task.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.task.groupBy({
      by: ['priority'],
      _count: { id: true },
    }),
    prisma.timeLog.groupBy({
      by: ['userId'],
      where: timeLogWhere,
      _sum: { hours: true },
    }),
    prisma.timeLog.findMany({
      where: timeLogWhere,
      include: {
        user: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
        object: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 50,
    }),
  ])

  const userIds = timeByUser.map((r) => r.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  })
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))

  return {
    tasksByStatus: tasksByStatus.map((r) => ({ status: r.status, count: r._count.id })),
    tasksByPriority: tasksByPriority.map((r) => ({ priority: r.priority, count: r._count.id })),
    timeByUser: timeByUser.map((r) => ({
      userId: r.userId,
      userName: userMap[r.userId] ?? 'Невідомий',
      totalHours: r._sum.hours ?? 0,
    })),
    recentTimeLogs,
  }
})
