import { requirePermission } from '../../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'equipment.view')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID обовʼязковий' })

  const equipment = await prisma.equipment.findUnique({ where: { id }, select: { id: true } })
  if (!equipment) {
    throw createError({ statusCode: 404, statusMessage: 'Обладнання не знайдено' })
  }

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const skip = (page - 1) * limit

  const [statusHistory, total] = await Promise.all([
    prisma.equipmentStatusLog.findMany({
      where: { equipmentId: id },
      include: {
        changedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.equipmentStatusLog.count({ where: { equipmentId: id } }),
  ])

  return { statusHistory, total, page, limit }
})
