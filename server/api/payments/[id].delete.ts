import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const id = getRouterParam(event, 'id')!

  const existing = await prisma.payment.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Оплату не знайдено' })

  await prisma.payment.delete({ where: { id } })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'DELETE',
    entityType: 'Payment',
    entityId: id,
    changes: { direction: existing.direction, amount: Number(existing.amount) },
  })

  return { success: true }
})
