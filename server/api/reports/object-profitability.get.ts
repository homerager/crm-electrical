import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const objects = await prisma.constructionObject.findMany({
    select: { id: true, name: true, status: true, budget: true, clientId: true },
    orderBy: { createdAt: 'desc' },
  })

  const results = await Promise.all(objects.map(async (obj) => {
    // Оплати клієнта (incoming) за цей обʼєкт
    const incomingAgg = await prisma.payment.aggregate({
      where: { objectId: obj.id, direction: 'INCOMING', status: 'COMPLETED' },
      _sum: { amount: true },
    })
    const income = Number(incomingAgg._sum.amount ?? 0)

    // Витрати на матеріали: invoice items через movements до цього обʼєкта
    const movements = await prisma.movement.findMany({
      where: { objectId: obj.id, type: 'WAREHOUSE_TO_OBJECT' },
      include: { items: { include: { product: true } } },
      select: { fromWarehouseId: true, items: { select: { productId: true, quantity: true } } },
    })

    let materialCost = 0
    for (const mov of movements) {
      if (!mov.fromWarehouseId) continue
      for (const item of mov.items) {
        const invLine = await prisma.invoiceItem.findFirst({
          where: { productId: item.productId, invoice: { warehouseId: mov.fromWarehouseId } },
          orderBy: { invoice: { date: 'desc' } },
          select: { pricePerUnit: true },
        })
        if (invLine) {
          materialCost += Number(item.quantity) * Number(invLine.pricePerUnit)
        }
      }
    }

    // Витрати на зарплати
    const timeLogs = await prisma.timeLog.findMany({
      where: {
        OR: [
          { task: { objectId: obj.id } },
          { objectId: obj.id, taskId: null },
        ],
      },
      include: { user: { select: { hourlyRate: true } } },
    })

    let laborCost = 0
    for (const log of timeLogs) {
      if (log.user.hourlyRate) {
        laborCost += log.hours * Number(log.user.hourlyRate)
      }
    }

    const totalExpenses = materialCost + laborCost
    const profit = income - totalExpenses
    const margin = income > 0 ? (profit / income) * 100 : 0

    return {
      id: obj.id,
      name: obj.name,
      status: obj.status,
      budget: obj.budget ? Number(obj.budget) : null,
      income: Math.round(income * 100) / 100,
      materialCost: Math.round(materialCost * 100) / 100,
      laborCost: Math.round(laborCost * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      margin: Math.round(margin * 100) / 100,
    }
  }))

  return { objects: results }
})
