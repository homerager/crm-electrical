export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const skip = (page - 1) * limit
  const unreadOnly = query.unreadOnly === 'true'

  const where: Record<string, unknown> = { userId: auth.userId }
  if (unreadOnly) where.isRead = false

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { userId: auth.userId, isRead: false },
    }),
  ])

  return { items, total, unreadCount, page, limit }
})
