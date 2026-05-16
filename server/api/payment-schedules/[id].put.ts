import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const existing = await prisma.paymentSchedule.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Запис графіку не знайдено' })

  const { objectId, clientId, amount, dueDate, status, description } = body

  const updated = await prisma.paymentSchedule.update({
    where: { id },
    data: {
      ...(objectId !== undefined && { objectId }),
      ...(clientId !== undefined && { clientId: clientId || null }),
      ...(amount !== undefined && { amount: Number(amount) }),
      ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
      ...(status !== undefined && { status }),
      ...(description !== undefined && { description: description?.trim() || null }),
    },
    include: {
      object: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  const auditDiff = computeChanges(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>)
  if (auditDiff) {
    writeAuditLog({
      userId: auth.userId,
      userName: auth.name,
      action: 'UPDATE',
      entityType: 'PaymentSchedule',
      entityId: id,
      changes: auditDiff,
    })
  }

  return updated
})
