import { requirePermission } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'equipment.delete')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID обовʼязковий' })

  const existing = await prisma.equipment.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Обладнання не знайдено' })
  }

  await prisma.equipment.delete({ where: { id } })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'DELETE',
    entityType: 'Equipment',
    entityId: id,
    changes: { name: existing.name },
  })

  return { success: true }
})
