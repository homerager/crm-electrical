import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const existing = await prisma.payment.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Оплату не знайдено' })

  const { direction, status, method, amount, date, description, objectId, clientId, contractorId, invoiceId } = body

  const updated = await prisma.payment.update({
    where: { id },
    data: {
      ...(direction !== undefined && { direction }),
      ...(status !== undefined && { status }),
      ...(method !== undefined && { method }),
      ...(amount !== undefined && { amount: Number(amount) }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(objectId !== undefined && { objectId: objectId || null }),
      ...(clientId !== undefined && { clientId: clientId || null }),
      ...(contractorId !== undefined && { contractorId: contractorId || null }),
      ...(invoiceId !== undefined && { invoiceId: invoiceId || null }),
    },
    include: {
      object: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      contractor: { select: { id: true, name: true } },
      invoice: { select: { id: true, number: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  const auditDiff = computeChanges(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>)
  if (auditDiff) {
    writeAuditLog({
      userId: auth.userId,
      userName: auth.name,
      action: 'UPDATE',
      entityType: 'Payment',
      entityId: id,
      changes: auditDiff,
    })
  }

  return updated
})
