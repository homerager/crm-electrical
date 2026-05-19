import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const query = getQuery(event)
  const status = query.status as string | undefined
  const warehouseId = query.warehouseId as string | undefined
  const objectId = query.objectId as string | undefined
  const responsibleUserId = query.responsibleUserId as string | undefined
  const search = query.search as string | undefined

  const where: any = {}
  if (status) where.status = status
  if (warehouseId) where.currentWarehouseId = warehouseId
  if (objectId) where.currentObjectId = objectId
  if (responsibleUserId) where.responsibleUserId = responsibleUserId
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { model: { contains: search, mode: 'insensitive' } },
      { serialNumber: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
    ]
  }

  const equipment = await prisma.equipment.findMany({
    where,
    include: {
      currentWarehouse: { select: { id: true, name: true } },
      currentObject: { select: { id: true, name: true } },
      responsibleUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return { equipment }
})
