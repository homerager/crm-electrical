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

  return { object, movements, summary, summaryTotalAmount, summaryHasMissingPrice }
})
