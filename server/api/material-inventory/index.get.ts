import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const query = getQuery(event)
  const warehouseId = query.warehouseId as string | undefined
  const status = query.status as string | undefined
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const skip = (page - 1) * limit

  const where: any = {}
  if (warehouseId) where.warehouseId = warehouseId
  if (status) where.status = status

  const [sessions, total] = await Promise.all([
    prisma.materialInventorySession.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true } },
        startedBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { startedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.materialInventorySession.count({ where }),
  ])

  return { sessions, total, page, limit }
})
