import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const query = getQuery(event)
  const userId = query.userId as string | undefined
  const objectId = query.objectId as string | undefined
  const type = query.type as string | undefined
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined

  const where: any = {}

  if (!isElevatedRole(auth.role)) {
    where.userId = auth.userId
  } else if (userId) {
    where.userId = userId
  }

  if (objectId) where.objectId = objectId
  if (type) where.type = type

  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) where.date.gte = new Date(dateFrom)
    if (dateTo) where.date.lte = new Date(dateTo)
  }

  const schedules = await prisma.schedule.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, jobTitle: { select: { name: true } } } },
      object: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ date: 'asc' }, { userId: 'asc' }],
  })

  return { schedules }
})
