import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const body = await readBody(event)
  const { direction, status, method, amount, date, description, objectId, clientId, contractorId, invoiceId } = body

  if (!direction || !['INCOMING', 'OUTGOING'].includes(direction)) {
    throw createError({ statusCode: 400, statusMessage: 'Напрямок оплати обов\'язковий (INCOMING/OUTGOING)' })
  }
  if (!amount || Number(amount) <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Сума повинна бути більше 0' })
  }
  if (!date) {
    throw createError({ statusCode: 400, statusMessage: 'Дата обов\'язкова' })
  }

  const payment = await prisma.payment.create({
    data: {
      direction,
      status: status || 'COMPLETED',
      method: method || 'BANK_TRANSFER',
      amount: Number(amount),
      date: new Date(date),
      description: description?.trim() || null,
      objectId: objectId || null,
      clientId: clientId || null,
      contractorId: contractorId || null,
      invoiceId: invoiceId || null,
      createdById: auth.userId,
    },
    include: {
      object: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      contractor: { select: { id: true, name: true } },
      invoice: { select: { id: true, number: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'CREATE',
    entityType: 'Payment',
    entityId: payment.id,
    changes: { direction, amount: Number(amount), status: payment.status },
  })

  return payment
})
