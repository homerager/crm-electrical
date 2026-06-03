import { requirePermission } from '../../../utils/authz'
import { emptyToNull } from '../../../utils/strings'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'equipment.edit')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID обовʼязковий' })

  const equipment = await prisma.equipment.findUnique({ where: { id } })
  if (!equipment) {
    throw createError({ statusCode: 404, statusMessage: 'Обладнання не знайдено' })
  }

  const body = await readBody(event)
  const { toWarehouseId, toObjectId, reason, photoUrl } = body

  const toWh = emptyToNull(toWarehouseId)
  const toObj = emptyToNull(toObjectId)

  if (!toWh && !toObj) {
    throw createError({ statusCode: 400, statusMessage: 'Вкажіть місце призначення (склад або обʼєкт)' })
  }
  if (toWh && toObj) {
    throw createError({ statusCode: 400, statusMessage: 'Оберіть лише одне місце призначення: склад або обʼєкт' })
  }

  if (toWh) {
    const warehouse = await prisma.warehouse.findUnique({ where: { id: toWh }, select: { id: true } })
    if (!warehouse) {
      throw createError({ statusCode: 404, statusMessage: 'Склад призначення не знайдено' })
    }
  }
  if (toObj) {
    const obj = await prisma.constructionObject.findUnique({ where: { id: toObj }, select: { id: true } })
    if (!obj) {
      throw createError({ statusCode: 404, statusMessage: 'Обʼєкт призначення не знайдено' })
    }
  }

  const isSameLocation
    = (toWh && toWh === equipment.currentWarehouseId && !equipment.currentObjectId)
    || (toObj && toObj === equipment.currentObjectId && !equipment.currentWarehouseId)
  if (isSameLocation) {
    throw createError({ statusCode: 400, statusMessage: 'Обладнання вже знаходиться в цьому місці' })
  }

  const movement = await prisma.$transaction(async (tx) => {
    const created = await tx.equipmentMovement.create({
      data: {
        equipmentId: id,
        fromWarehouseId: equipment.currentWarehouseId,
        fromObjectId: equipment.currentObjectId,
        toWarehouseId: toWh,
        toObjectId: toObj,
        reason: emptyToNull(reason),
        photoUrl: emptyToNull(photoUrl),
        performedById: auth.userId,
      },
      include: {
        fromWarehouse: { select: { id: true, name: true } },
        fromObject: { select: { id: true, name: true } },
        toWarehouse: { select: { id: true, name: true } },
        toObject: { select: { id: true, name: true } },
        performedBy: { select: { id: true, name: true } },
      },
    })

    await tx.equipment.update({
      where: { id },
      data: {
        currentWarehouseId: toWh ?? null,
        currentObjectId: toObj ?? null,
      },
    })

    return created
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'UPDATE',
    entityType: 'Equipment',
    entityId: id,
    changes: {
      action: 'movement',
      fromWarehouseId: equipment.currentWarehouseId,
      fromObjectId: equipment.currentObjectId,
      toWarehouseId: toWh,
      toObjectId: toObj,
    },
  })

  return { movement }
})
