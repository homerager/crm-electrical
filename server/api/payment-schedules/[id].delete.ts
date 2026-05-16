import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const id = getRouterParam(event, 'id')!

  const existing = await prisma.paymentSchedule.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Запис графіку не знайдено' })

  await prisma.paymentSchedule.delete({ where: { id } })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'DELETE',
    entityType: 'PaymentSchedule',
    entityId: id,
    changes: { objectId: existing.objectId, amount: Number(existing.amount) },
  })

  return { success: true }
})
