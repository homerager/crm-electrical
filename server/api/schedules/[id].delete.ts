import { requirePermission } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'schedules.manage')

  const id = getRouterParam(event, 'id')!

  const existing = await prisma.schedule.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Запис розкладу не знайдено' })

  if (existing.timeLogId) {
    await prisma.timeLog.delete({ where: { id: existing.timeLogId } }).catch(() => {})
  }

  await prisma.schedule.delete({ where: { id } })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'DELETE',
    entityType: 'Schedule',
    entityId: id,
    changes: {
      userId: existing.userId,
      date: existing.date.toISOString(),
      type: existing.type,
      shift: existing.shift,
    },
  })

  return { success: true }
})
