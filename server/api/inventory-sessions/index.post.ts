import { isElevatedRole } from '../../utils/authz'
import { emptyToNull } from '../../utils/strings'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const { warehouseId, objectId } = body

  const wh = emptyToNull(warehouseId)
  const obj = emptyToNull(objectId)

  if (!wh && !obj) {
    throw createError({ statusCode: 400, statusMessage: 'Вкажіть локацію (склад або обʼєкт)' })
  }
  if (wh && obj) {
    throw createError({ statusCode: 400, statusMessage: 'Оберіть лише одну локацію: склад або обʼєкт' })
  }

  if (wh) {
    const warehouse = await prisma.warehouse.findUnique({ where: { id: wh }, select: { id: true } })
    if (!warehouse) {
      throw createError({ statusCode: 404, statusMessage: 'Склад не знайдено' })
    }
  }
  if (obj) {
    const object = await prisma.constructionObject.findUnique({ where: { id: obj }, select: { id: true } })
    if (!object) {
      throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })
    }
  }

  const existingActive = await prisma.inventorySession.findFirst({
    where: {
      status: 'IN_PROGRESS',
      ...(wh ? { warehouseId: wh } : { objectId: obj }),
    },
  })
  if (existingActive) {
    throw createError({ statusCode: 409, statusMessage: 'Для цієї локації вже є активна сесія інвентаризації' })
  }

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.inventorySession.create({
      data: {
        warehouseId: wh,
        objectId: obj,
        startedById: auth.userId,
      },
      include: {
        warehouse: { select: { id: true, name: true } },
        object: { select: { id: true, name: true } },
        startedBy: { select: { id: true, name: true } },
      },
    })

    const equipmentAtLocation = await tx.equipment.findMany({
      where: wh
        ? { currentWarehouseId: wh }
        : { currentObjectId: obj },
      select: { id: true },
    })

    if (equipmentAtLocation.length > 0) {
      await tx.inventorySessionItem.createMany({
        data: equipmentAtLocation.map(eq => ({
          sessionId: created.id,
          equipmentId: eq.id,
          found: false,
        })),
      })
    }

    return created
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'CREATE',
    entityType: 'InventorySession',
    entityId: session.id,
    changes: { warehouseId: wh, objectId: obj },
  })

  return { session }
})
