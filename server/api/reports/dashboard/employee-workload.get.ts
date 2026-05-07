export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1)

  const [timeByUser, tasksByUser] = await Promise.all([
    prisma.timeLog.groupBy({
      by: ['userId'],
      where: { date: { gte: from } },
      _sum: { hours: true },
    }),
    prisma.task.groupBy({
      by: ['assignedToId', 'status'],
      where: {
        assignedToId: { not: null },
        OR: [
          { updatedAt: { gte: from } },
          { status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW'] } },
        ],
      },
      _count: { id: true },
    }),
  ])

  const userIds = [
    ...new Set([
      ...timeByUser.map((r) => r.userId),
      ...tasksByUser.map((r) => r.assignedToId).filter(Boolean) as string[],
    ]),
  ]

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  })
  const nameMap = Object.fromEntries(users.map((u) => [u.id, u.name]))

  const hoursMap = new Map<string, number>()
  for (const r of timeByUser) {
    hoursMap.set(r.userId, Math.round((r._sum.hours ?? 0) * 100) / 100)
  }

  const taskMap = new Map<string, { active: number; done: number }>()
  for (const r of tasksByUser) {
    const uid = r.assignedToId!
    if (!taskMap.has(uid)) taskMap.set(uid, { active: 0, done: 0 })
    const entry = taskMap.get(uid)!
    if (['TODO', 'IN_PROGRESS', 'REVIEW'].includes(r.status)) {
      entry.active += r._count.id
    } else if (r.status === 'DONE') {
      entry.done += r._count.id
    }
  }

  const combined = userIds
    .map((uid) => ({
      userId: uid,
      name: nameMap[uid] ?? 'Невідомий',
      hours: hoursMap.get(uid) ?? 0,
      activeTasks: taskMap.get(uid)?.active ?? 0,
      doneTasks: taskMap.get(uid)?.done ?? 0,
    }))
    .sort((a, b) => b.hours - a.hours)

  return {
    users: combined.map((u) => u.name),
    hours: combined.map((u) => u.hours),
    activeTasks: combined.map((u) => u.activeTasks),
    doneTasks: combined.map((u) => u.doneTasks),
  }
})
