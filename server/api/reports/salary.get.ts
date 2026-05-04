import { isStrictAdmin } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isStrictAdmin(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Недостатньо прав' })
  }

  const query = getQuery(event)
  const from = query.from ? new Date(query.from as string) : undefined
  const to = query.to
    ? (() => { const d = new Date(query.to as string); d.setHours(23, 59, 59, 999); return d })()
    : undefined
  const userId = query.userId as string | undefined

  const dateFilter = from || to
    ? { date: { ...(from && { gte: from }), ...(to && { lte: to }) } }
    : {}

  const where: any = { ...dateFilter }
  if (userId) where.userId = userId

  // All time logs in range (with task and user)
  const timeLogs = await prisma.timeLog.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, hourlyRate: true } },
      task: {
        select: {
          id: true,
          title: true,
          project: { select: { id: true, name: true, color: true } },
          object: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ userId: 'asc' }, { date: 'desc' }],
  })

  // Group by user
  const userMap = new Map<string, {
    userId: string
    userName: string
    totalHours: number
    hourlyRate: number | null
    totalAmount: number | null
    logs: typeof timeLogs
  }>()

  for (const log of timeLogs) {
    const uid = log.userId
    const rate = log.user.hourlyRate != null ? Number(log.user.hourlyRate) : null
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        userId: uid,
        userName: log.user.name,
        totalHours: 0,
        hourlyRate: rate,
        totalAmount: null,
        logs: [],
      })
    }
    const entry = userMap.get(uid)!
    if (entry.hourlyRate == null && rate != null) {
      entry.hourlyRate = rate
    }
    entry.totalHours += log.hours
    entry.logs.push(log)
  }

  for (const entry of userMap.values()) {
    if (entry.hourlyRate != null) {
      entry.totalAmount = Math.round(entry.totalHours * entry.hourlyRate * 100) / 100
    }
  }

  const users = Array.from(userMap.values()).sort((a, b) => b.totalHours - a.totalHours)

  return { users, totalLogs: timeLogs.length }
})
