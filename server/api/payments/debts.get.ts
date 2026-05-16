import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  // Дебіторська заборгованість: скільки мають заплатити клієнти (scheduled - paid incoming)
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      payments: {
        where: { direction: 'INCOMING', status: 'COMPLETED' },
        select: { amount: true },
      },
      paymentSchedules: {
        where: { status: { in: ['EXPECTED', 'OVERDUE'] } },
        select: { amount: true, dueDate: true, status: true },
      },
    },
  })

  const receivables = clients
    .map((c) => {
      const totalPaid = c.payments.reduce((s, p) => s + Number(p.amount), 0)
      const totalScheduled = c.paymentSchedules.reduce((s, ps) => s + Number(ps.amount), 0)
      const overdue = c.paymentSchedules
        .filter((ps) => new Date(ps.dueDate) < new Date())
        .reduce((s, ps) => s + Number(ps.amount), 0)
      const debt = totalScheduled - totalPaid
      return {
        id: c.id,
        name: c.name,
        totalScheduled,
        totalPaid,
        debt: debt > 0 ? debt : 0,
        overdue,
      }
    })
    .filter((r) => r.totalScheduled > 0 || r.totalPaid > 0)
    .sort((a, b) => b.debt - a.debt)

  // Кредиторська заборгованість: скільки ми маємо заплатити контрагентам
  const contractors = await prisma.contractor.findMany({
    select: {
      id: true,
      name: true,
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
  })

  const payables = contractors
    .map((c) => {
      const totalInvoiced = c.invoices.reduce((sum, inv) => {
        return sum + inv.items.reduce((s, item) => {
          const base = Number(item.quantity) * Number(item.pricePerUnit)
          const vat = base * Number(item.vatPercent) / 100
          return s + base + vat
        }, 0)
      }, 0)
      const totalPaid = c.payments.reduce((s, p) => s + Number(p.amount), 0)
      const debt = totalInvoiced - totalPaid
      return {
        id: c.id,
        name: c.name,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        totalPaid,
        debt: debt > 0 ? Math.round(debt * 100) / 100 : 0,
      }
    })
    .filter((r) => r.totalInvoiced > 0 || r.totalPaid > 0)
    .sort((a, b) => b.debt - a.debt)

  const totalReceivables = receivables.reduce((s, r) => s + r.debt, 0)
  const totalPayables = payables.reduce((s, r) => s + r.debt, 0)

  return {
    receivables,
    payables,
    totalReceivables: Math.round(totalReceivables * 100) / 100,
    totalPayables: Math.round(totalPayables * 100) / 100,
  }
})
