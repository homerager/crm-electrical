import { isElevatedRole } from '../../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID обовʼязковий' })

  const session = await prisma.inventorySession.findUnique({
    where: { id },
    include: {
      warehouse: { select: { id: true, name: true } },
      object: { select: { id: true, name: true } },
      startedBy: { select: { id: true, name: true } },
      items: {
        include: {
          equipment: {
            select: {
              id: true,
              name: true,
              model: true,
              serialNumber: true,
              barcode: true,
              status: true,
              currentWarehouseId: true,
              currentObjectId: true,
            },
          },
        },
      },
    },
  })

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Сесію інвентаризації не знайдено' })
  }

  const found = session.items.filter(i => i.found)
  const notFound = session.items.filter(i => !i.found)

  const unexpectedItems = found.filter((i) => {
    const eq = i.equipment
    if (session.warehouseId) {
      return eq.currentWarehouseId !== session.warehouseId
    }
    return eq.currentObjectId !== session.objectId
  })

  const matchedItems = found.filter((i) => {
    const eq = i.equipment
    if (session.warehouseId) {
      return eq.currentWarehouseId === session.warehouseId
    }
    return eq.currentObjectId === session.objectId
  })

  return {
    session: {
      id: session.id,
      status: session.status,
      warehouseId: session.warehouseId,
      objectId: session.objectId,
      warehouse: session.warehouse,
      object: session.object,
      startedBy: session.startedBy,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    },
    summary: {
      totalExpected: session.items.length,
      found: found.length,
      notFound: notFound.length,
      unexpected: unexpectedItems.length,
      matched: matchedItems.length,
    },
    matched: matchedItems.map(i => ({
      equipmentId: i.equipmentId,
      equipment: i.equipment,
      scannedAt: i.scannedAt,
    })),
    notFound: notFound.map(i => ({
      equipmentId: i.equipmentId,
      equipment: i.equipment,
    })),
    unexpected: unexpectedItems.map(i => ({
      equipmentId: i.equipmentId,
      equipment: i.equipment,
      scannedAt: i.scannedAt,
    })),
  }
})
