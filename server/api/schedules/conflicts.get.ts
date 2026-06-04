import { requirePermission } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'schedules.manage')

  const query = getQuery(event)
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined

  const where: any = {}
  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) where.date.gte = new Date(dateFrom)
    if (dateTo) where.date.lte = new Date(dateTo)
  }

  const schedules = await prisma.schedule.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      object: { select: { id: true, name: true } },
    },
    orderBy: [{ date: 'asc' }, { userId: 'asc' }],
  })

  const conflicts: Array<{
    userId: string
    userName: string
    date: string
    entries: typeof schedules
  }> = []

  const grouped = new Map<string, typeof schedules>()
  for (const s of schedules) {
    const key = `${s.userId}|${s.date.toISOString().split('T')[0]}`
    const arr = grouped.get(key) || []
    arr.push(s)
    grouped.set(key, arr)
  }

  for (const [, entries] of grouped) {
    if (entries.length < 2) continue
    const hasFullDay = entries.some((e) => e.shift === 'FULL_DAY')
    const hasDuplicateShift = entries.length > new Set(entries.map((e) => e.shift)).size
    if (hasFullDay || hasDuplicateShift) {
      conflicts.push({
        userId: entries[0].userId,
        userName: entries[0].user.name,
        date: entries[0].date.toISOString().split('T')[0],
        entries,
      })
    }
  }

  return { conflicts }
})
