import type { Prisma } from '@prisma/client'
import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Недостатньо прав' })
  }

  const query = getQuery(event)
  const userId = query.userId as string | undefined
  const objectId = query.objectId as string | undefined
  const from = query.from ? new Date(query.from as string) : undefined
  const to = query.to
    ? (() => { const d = new Date(query.to as string); d.setHours(23, 59, 59, 999); return d })()
    : undefined
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 30))

  const where: Prisma.TimeLogWhereInput = {}

  if (userId) where.userId = userId

  if (objectId) {
    where.OR = [{ objectId }, { task: { objectId } }]
  }

  if (from || to) {
    where.date = { ...(from && { gte: from }), ...(to && { lte: to }) }
  }

  const [total, logs] = await Promise.all([
    prisma.timeLog.count({ where }),
    prisma.timeLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            objectId: true,
            object: { select: { id: true, name: true } },
          },
        },
        object: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return { logs, total, page, pageSize }
})
