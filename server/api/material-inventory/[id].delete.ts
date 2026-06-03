import { requirePermission } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'inventory.manage')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID обовʼязковий' })

  const session = await prisma.materialInventorySession.findUnique({ where: { id } })
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Сесію інвентаризації не знайдено' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.materialInventoryItem.deleteMany({ where: { sessionId: id } })
    await tx.materialInventorySession.delete({ where: { id } })
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'DELETE',
    entityType: 'MaterialInventorySession',
    entityId: id,
    changes: { warehouseId: session.warehouseId },
  })

  return { success: true }
})
