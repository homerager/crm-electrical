import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID обовʼязковий' })

  const session = await prisma.inventorySession.findUnique({ where: { id } })
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Сесію інвентаризації не знайдено' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.inventorySessionItem.deleteMany({ where: { sessionId: id } })
    await tx.inventorySession.delete({ where: { id } })
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'DELETE',
    entityType: 'InventorySession',
    entityId: id,
    changes: { warehouseId: session.warehouseId, objectId: session.objectId },
  })

  return { success: true }
})
