import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const query = getQuery(event)
  const objectId = query.objectId as string
  if (!objectId) throw createError({ statusCode: 400, statusMessage: 'objectId обов\'язковий' })

  // Скільки виставлено (scheduled)
  const scheduled = await prisma.paymentSchedule.aggregate({
    where: { objectId },
    _sum: { amount: true },
  })
  const totalScheduled = Number(scheduled._sum.amount ?? 0)

  // Скільки оплачено (completed incoming)
  const paid = await prisma.payment.aggregate({
    where: { objectId, direction: 'INCOMING', status: 'COMPLETED' },
    _sum: { amount: true },
  })
  const totalPaid = Number(paid._sum.amount ?? 0)

  // Борг
  const debt = totalScheduled - totalPaid

  // Витрати (outgoing payments for this object)
  const expenses = await prisma.payment.aggregate({
    where: { objectId, direction: 'OUTGOING', status: 'COMPLETED' },
    _sum: { amount: true },
  })
  const totalExpenses = Number(expenses._sum.amount ?? 0)

  // Прибуток (оплати клієнта - витрати на цей об'єкт)
  const profit = totalPaid - totalExpenses

  return {
    objectId,
    totalScheduled: Math.round(totalScheduled * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    debt: Math.round((debt > 0 ? debt : 0) * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    profit: Math.round(profit * 100) / 100,
  }
})
