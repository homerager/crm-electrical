import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const query = getQuery(event)
  const objectId = query.objectId as string | undefined
  const months = Number(query.months) || 12

  const baseWhere: any = { status: 'COMPLETED' }
  if (objectId) baseWhere.objectId = objectId

  const [incoming, outgoing] = await Promise.all([
    prisma.payment.aggregate({
      where: { ...baseWhere, direction: 'INCOMING' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { ...baseWhere, direction: 'OUTGOING' },
      _sum: { amount: true },
      _count: true,
    }),
  ])

  const totalIncoming = Number(incoming._sum.amount ?? 0)
  const totalOutgoing = Number(outgoing._sum.amount ?? 0)
  const balance = totalIncoming - totalOutgoing

  // Cash flow by month
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months + 1)
  startDate.setDate(1)
  startDate.setHours(0, 0, 0, 0)

  const payments = await prisma.payment.findMany({
    where: {
      ...baseWhere,
      date: { gte: startDate },
    },
    select: { direction: true, amount: true, date: true },
    orderBy: { date: 'asc' },
  })

  const cashFlow: Record<string, { month: string; incoming: number; outgoing: number; balance: number }> = {}
  for (const p of payments) {
    const key = `${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, '0')}`
    if (!cashFlow[key]) cashFlow[key] = { month: key, incoming: 0, outgoing: 0, balance: 0 }
    const amt = Number(p.amount)
    if (p.direction === 'INCOMING') cashFlow[key].incoming += amt
    else cashFlow[key].outgoing += amt
    cashFlow[key].balance = cashFlow[key].incoming - cashFlow[key].outgoing
  }

  const cashFlowData = Object.values(cashFlow).sort((a, b) => a.month.localeCompare(b.month))

  // Overdue payment schedules
  const overdueSchedules = await prisma.paymentSchedule.count({
    where: {
      status: 'EXPECTED',
      dueDate: { lt: new Date() },
      ...(objectId ? { objectId } : {}),
    },
  })

  return {
    totalIncoming,
    totalOutgoing,
    balance,
    incomingCount: incoming._count,
    outgoingCount: outgoing._count,
    cashFlow: cashFlowData,
    overdueSchedules,
  }
})
