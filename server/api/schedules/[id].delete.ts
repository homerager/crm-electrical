import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const id = getRouterParam(event, 'id')!

  const existing = await prisma.schedule.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Запис розкладу не знайдено' })

  await prisma.schedule.delete({ where: { id } })

  if (existing.timeLogId) {
    await prisma.timeLog.delete({ where: { id: existing.timeLogId } }).catch(() => {})
  }

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'DELETE',
    entityType: 'Schedule',
    entityId: id,
    changes: { userId: existing.userId, date: existing.date.toISOString(), type: existing.type },
  })

  return { success: true }
})
