import { requirePermission } from '../../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'payments.dashboard')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const [
    totalIncomingAgg,
    totalOutgoingAgg,
    monthIncomingAgg,
    monthOutgoingAgg,
    overdueSchedules,
    overdueAmountAgg,
    receivablesRaw,
    payablesRaw,
    cashFlowPayments,
    upcomingSchedules,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { direction: 'INCOMING', status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { direction: 'OUTGOING', status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { direction: 'INCOMING', status: 'COMPLETED', date: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { direction: 'OUTGOING', status: 'COMPLETED', date: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.paymentSchedule.count({
      where: { status: 'EXPECTED', dueDate: { lt: now } },
    }),
    prisma.paymentSchedule.aggregate({
      where: { status: 'EXPECTED', dueDate: { lt: now } },
      _sum: { amount: true },
    }),
    prisma.client.findMany({
      select: {
        payments: {
          where: { direction: 'INCOMING', status: 'COMPLETED' },
          select: { amount: true },
        },
        paymentSchedules: {
          where: { status: { in: ['EXPECTED', 'OVERDUE'] } },
          select: { amount: true },
        },
      },
    }),
    prisma.contractor.findMany({
      select: {
        invoices: {
          where: { type: 'INCOMING' },
          select: {
            items: { select: { quantity: true, pricePerUnit: true, vatPercent: true } },
          },
        },
        payments: {
          where: { direction: 'OUTGOING', status: 'COMPLETED' },
          select: { amount: true },
        },
      },
    }),
    prisma.payment.findMany({
      where: { status: 'COMPLETED', date: { gte: sixMonthsAgo } },
      select: { direction: true, amount: true, date: true },
      orderBy: { date: 'asc' },
    }),
    prisma.paymentSchedule.findMany({
      where: { status: 'EXPECTED', dueDate: { gte: now } },
      include: {
        object: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
    }),
  ])

  const balance = Number(totalIncomingAgg._sum.amount ?? 0) - Number(totalOutgoingAgg._sum.amount ?? 0)
  const monthIncoming = Number(monthIncomingAgg._sum.amount ?? 0)
  const monthOutgoing = Number(monthOutgoingAgg._sum.amount ?? 0)
  const overdueAmount = Number(overdueAmountAgg._sum.amount ?? 0)

  // Receivables
  let totalReceivables = 0
  for (const c of receivablesRaw) {
    const paid = c.payments.reduce((s, p) => s + Number(p.amount), 0)
    const scheduled = c.paymentSchedules.reduce((s, ps) => s + Number(ps.amount), 0)
    const debt = scheduled - paid
    if (debt > 0) totalReceivables += debt
  }

  // Payables
  let totalPayables = 0
  for (const c of payablesRaw) {
    const invoiced = c.invoices.reduce((sum, inv) => {
      return sum + inv.items.reduce((s, item) => {
        const base = Number(item.quantity) * Number(item.pricePerUnit)
        const vat = base * Number(item.vatPercent) / 100
        return s + base + vat
      }, 0)
    }, 0)
    const paid = c.payments.reduce((s, p) => s + Number(p.amount), 0)
    const debt = invoiced - paid
    if (debt > 0) totalPayables += debt
  }

  // Cash flow by month (6 months)
  const cashFlowMap: Record<string, { month: string; incoming: number; outgoing: number }> = {}
  for (let m = 0; m < 6; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + m, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    cashFlowMap[key] = { month: key, incoming: 0, outgoing: 0 }
  }
  for (const p of cashFlowPayments) {
    const key = `${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, '0')}`
    const bucket = cashFlowMap[key]
    if (!bucket) continue
    const amt = Number(p.amount)
    if (p.direction === 'INCOMING') bucket.incoming += amt
    else bucket.outgoing += amt
  }
  const cashFlow = Object.values(cashFlowMap).sort((a, b) => a.month.localeCompare(b.month))

  // Upcoming payments
  const upcomingPayments = upcomingSchedules.map((s) => ({
    id: s.id,
    dueDate: s.dueDate,
    amount: Number(s.amount),
    status: s.status,
    objectName: s.object?.name ?? '—',
    clientName: s.client?.name ?? '—',
  }))

  return {
    balance: Math.round(balance * 100) / 100,
    monthIncoming: Math.round(monthIncoming * 100) / 100,
    monthOutgoing: Math.round(monthOutgoing * 100) / 100,
    overdueCount: overdueSchedules,
    overdueAmount: Math.round(overdueAmount * 100) / 100,
    totalReceivables: Math.round(totalReceivables * 100) / 100,
    totalPayables: Math.round(totalPayables * 100) / 100,
    cashFlow,
    upcomingPayments,
  }
})
