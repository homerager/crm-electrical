export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const object = await prisma.constructionObject.findUnique({ where: { id } })
  if (!object) throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })

  const movements = await prisma.movement.findMany({
    where: { objectId: id, type: 'WAREHOUSE_TO_OBJECT' },
    include: {
      items: { include: { product: true } },
      fromWarehouse: true,
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  })

  const priceCache = new Map<string, number | null>()

  async function latestInvoiceUnitPrice(
    productId: string,
    warehouseId: string,
  ): Promise<number | null> {
    const cacheKey = `${productId}:${warehouseId}`
    if (priceCache.has(cacheKey)) return priceCache.get(cacheKey) ?? null
    const line = await prisma.invoiceItem.findFirst({
      where: { productId, invoice: { warehouseId } },
      orderBy: { invoice: { date: 'desc' } },
      select: { pricePerUnit: true },
    })
    const p = line != null ? Number(line.pricePerUnit) : null
    priceCache.set(cacheKey, p)
    return p
  }

  const productMap = new Map<
    string,
    {
      product: any
      totalQuantity: number
      unit: string
      totalAmount: number
      hasMissingPrice: boolean
    }
  >()

  for (const movement of movements) {
    const warehouseId = movement.fromWarehouseId
    if (!warehouseId) continue
    for (const item of movement.items) {
      const key = item.productId
      const qty = Number(item.quantity)
      const price = await latestInvoiceUnitPrice(item.productId, warehouseId)
      const lineAmount = price != null ? qty * price : 0

      if (productMap.has(key)) {
        const row = productMap.get(key)!
        row.totalQuantity += qty
        row.totalAmount += lineAmount
        if (price == null) row.hasMissingPrice = true
      } else {
        productMap.set(key, {
          product: item.product,
          totalQuantity: qty,
          unit: item.product.unit,
          totalAmount: lineAmount,
          hasMissingPrice: price == null,
        })
      }
    }
  }

  const summary = Array.from(productMap.values())
    .map((row) => ({
      ...row,
      averageUnitPrice: row.hasMissingPrice ? null : row.totalQuantity > 0 ? row.totalAmount / row.totalQuantity : 0,
    }))
    .sort((a, b) => a.product.name.localeCompare(b.product.name))

  const summaryTotalAmount = summary.reduce((s, r) => s + r.totalAmount, 0)
  const summaryHasMissingPrice = summary.some((r) => r.hasMissingPrice)

  const timeLogs = await prisma.timeLog.findMany({
    where: {
      OR: [
        { task: { objectId: id, status: 'DONE' } },
        { objectId: id, taskId: null },
      ],
    },
    include: {
      user: { select: { id: true, name: true, hourlyRate: true } },
    },
    orderBy: [{ userId: 'asc' }, { date: 'desc' }],
  })

  type LaborRow = {
    userId: string
    userName: string
    totalHours: number
    hourlyRate: number | null
    totalAmount: number | null
  }

  const laborMap = new Map<string, LaborRow>()
  for (const log of timeLogs) {
    const uid = log.userId
    const rate = log.user.hourlyRate != null ? Number(log.user.hourlyRate) : null
    if (!laborMap.has(uid)) {
      laborMap.set(uid, {
        userId: uid,
        userName: log.user.name,
        totalHours: 0,
        hourlyRate: rate,
        totalAmount: null,
      })
    }
    const entry = laborMap.get(uid)!
    if (entry.hourlyRate == null && rate != null) entry.hourlyRate = rate
    entry.totalHours += log.hours
  }
  for (const entry of laborMap.values()) {
    if (entry.hourlyRate != null) {
      entry.totalAmount = Math.round(entry.totalHours * entry.hourlyRate * 100) / 100
    }
  }

  const laborByUser = Array.from(laborMap.values()).sort((a, b) => b.totalHours - a.totalHours)
  const laborTotalHours = laborByUser.reduce((s, r) => s + r.totalHours, 0)
  const laborTotalAmount = laborByUser.reduce((s, r) => s + (typeof r.totalAmount === 'number' ? r.totalAmount : 0), 0)
  const laborHasMissingRate = laborByUser.some((r) => r.hourlyRate == null)

  const stockOnSite = await prisma.objectStock.findMany({
    where: { objectId: id, quantity: { gt: 0 } },
    include: { product: true },
    orderBy: { product: { name: 'asc' } },
  })

  const warehouseReservations = await prisma.warehouseObjectReservation.findMany({
    where: { objectId: id },
    include: {
      warehouse: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, sku: true, unit: true } },
    },
    orderBy: [{ warehouse: { name: 'asc' } }, { product: { name: 'asc' } }],
  })

  const writeOffMovements = await prisma.movement.findMany({
    where: { objectId: id, type: 'OBJECT_WRITE_OFF' },
    include: {
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: true } },
    },
    orderBy: { date: 'desc' },
  })

  const returnMovements = await prisma.movement.findMany({
    where: { objectId: id, type: 'OBJECT_TO_WAREHOUSE' },
    include: {
      toWarehouse: true,
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: true } },
    },
    orderBy: { date: 'desc' },
  })

  const consumedMap = new Map<
    string,
    { product: { id: string; name: string; sku: string | null; unit: string }; totalQuantity: number; unit: string }
  >()
  for (const movement of writeOffMovements) {
    for (const item of movement.items) {
      const key = item.productId
      const qty = Number(item.quantity)
      if (consumedMap.has(key)) {
        consumedMap.get(key)!.totalQuantity += qty
      } else {
        consumedMap.set(key, {
          product: item.product,
          totalQuantity: qty,
          unit: item.product.unit,
        })
      }
    }
  }

  const inboundValuationByProductId = new Map(summary.map((row) => [row.product.id, row]))

  const consumedSummary = Array.from(consumedMap.values())
    .map((row) => {
      const inbound = inboundValuationByProductId.get(row.product.id)
      let averageUnitPrice: number | null = null
      let totalAmount = 0
      let hasMissingPrice = true

      if (inbound && inbound.averageUnitPrice != null) {
        averageUnitPrice = inbound.averageUnitPrice
        totalAmount = Math.round(averageUnitPrice * row.totalQuantity * 100) / 100
        hasMissingPrice = false
      }

      return {
        ...row,
        averageUnitPrice,
        totalAmount,
        hasMissingPrice,
      }
    })
    .sort((a, b) => a.product.name.localeCompare(b.product.name))

  const consumedTotalAmount = consumedSummary.reduce((s, r) => s + r.totalAmount, 0)
  const consumedHasMissingPrice = consumedSummary.some((r) => r.hasMissingPrice)

  const budget = object.budget != null ? Number(object.budget) : null
  const totalExpenses = summaryTotalAmount + laborTotalAmount
  const budgetRemaining = budget != null ? budget - totalExpenses : null
  const budgetUsedPercent = budget != null && budget > 0
    ? Math.round((totalExpenses / budget) * 10000) / 100
    : null

  return {
    object,
    warehouseReservations,
    movements,
    summary,
    summaryTotalAmount,
    summaryHasMissingPrice,
    stockOnSite,
    consumedSummary,
    consumedTotalAmount,
    consumedHasMissingPrice,
    writeOffMovements,
    returnMovements,
    laborByUser,
    laborTotalHours,
    laborTotalAmount,
    laborHasMissingRate,
    laborLogCount: timeLogs.length,
    budget,
    totalExpenses,
    budgetRemaining,
    budgetUsedPercent,
  }
})
