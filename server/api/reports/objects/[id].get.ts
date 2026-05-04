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

  return {
    object,
    movements,
    summary,
    summaryTotalAmount,
    summaryHasMissingPrice,
    laborByUser,
    laborTotalHours,
    laborTotalAmount,
    laborHasMissingRate,
    laborLogCount: timeLogs.length,
  }
})
