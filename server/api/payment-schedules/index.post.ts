import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const body = await readBody(event)
  const { objectId, clientId, amount, dueDate, description } = body

  if (!objectId) {
    throw createError({ statusCode: 400, statusMessage: 'Обʼєкт обов\'язковий' })
  }
  if (!amount || Number(amount) <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Сума повинна бути більше 0' })
  }
  if (!dueDate) {
    throw createError({ statusCode: 400, statusMessage: 'Дата обов\'язкова' })
  }

  const schedule = await prisma.paymentSchedule.create({
    data: {
      objectId,
      clientId: clientId || null,
      amount: Number(amount),
      dueDate: new Date(dueDate),
      description: description?.trim() || null,
      createdById: auth.userId,
    },
    include: {
      object: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'CREATE',
    entityType: 'PaymentSchedule',
    entityId: schedule.id,
    changes: { objectId, amount: Number(amount), dueDate },
  })

  return schedule
})
