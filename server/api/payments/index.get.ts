import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const query = getQuery(event)
  const direction = query.direction as string | undefined
  const status = query.status as string | undefined
  const objectId = query.objectId as string | undefined
  const clientId = query.clientId as string | undefined
  const contractorId = query.contractorId as string | undefined
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined

  const where: any = {}
  if (direction) where.direction = direction
  if (status) where.status = status
  if (objectId) where.objectId = objectId
  if (clientId) where.clientId = clientId
  if (contractorId) where.contractorId = contractorId
  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) where.date.gte = new Date(dateFrom)
    if (dateTo) where.date.lte = new Date(dateTo)
  }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      object: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      contractor: { select: { id: true, name: true } },
      invoice: { select: { id: true, number: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  })

  return { payments }
})
