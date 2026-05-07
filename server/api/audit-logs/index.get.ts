export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const query = getQuery(event)
  const entityType = query.entityType as string | undefined
  const entityId = query.entityId as string | undefined
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (entityType) where.entityType = entityType
  if (entityId) where.entityId = entityId

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  return { items, total, page, limit }
})
