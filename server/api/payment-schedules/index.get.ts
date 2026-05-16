import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const query = getQuery(event)
  const objectId = query.objectId as string | undefined
  const clientId = query.clientId as string | undefined
  const status = query.status as string | undefined

  const where: any = {}
  if (objectId) where.objectId = objectId
  if (clientId) where.clientId = clientId
  if (status) where.status = status

  const schedules = await prisma.paymentSchedule.findMany({
    where,
    include: {
      object: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { dueDate: 'asc' },
  })

  return { schedules }
})
