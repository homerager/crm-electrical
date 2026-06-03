import { requirePermission } from '../../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'inventory.manage')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID обовʼязковий' })

  const session = await prisma.inventorySession.findUnique({ where: { id } })
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Сесію інвентаризації не знайдено' })
  }
  if (session.status === 'COMPLETED') {
    throw createError({ statusCode: 400, statusMessage: 'Сесія вже завершена' })
  }

  const updated = await prisma.inventorySession.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
    include: {
      warehouse: { select: { id: true, name: true } },
      object: { select: { id: true, name: true } },
      startedBy: { select: { id: true, name: true } },
    },
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'UPDATE',
    entityType: 'InventorySession',
    entityId: id,
    changes: { action: 'complete' },
  })

  return { session: updated }
})
