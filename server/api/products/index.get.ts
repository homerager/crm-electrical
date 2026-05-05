export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const search = query.search as string | undefined
  const forObjectId = query.forObjectId as string | undefined

  const products = await prisma.product.findMany({
    where: search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }] }
      : undefined,
    include: {
      group: true,
      stock: {
        include: { warehouse: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const reservationSums = await prisma.warehouseObjectReservation.groupBy({
    by: ['warehouseId', 'productId'],
    _sum: { quantity: true },
  })
  const reservedByWhProduct = new Map<string, number>()
  for (const r of reservationSums) {
    reservedByWhProduct.set(`${r.warehouseId}:${r.productId}`, Number(r._sum.quantity ?? 0))
  }

  let reservedForObjectRows: { warehouseId: string; productId: string; quantity: unknown }[] = []
  if (forObjectId) {
    reservedForObjectRows = await prisma.warehouseObjectReservation.findMany({
      where: { objectId: forObjectId },
      select: { warehouseId: true, productId: true, quantity: true },
    })
  }
  const reservedForObjectMap = new Map<string, number>()
  for (const row of reservedForObjectRows) {
    reservedForObjectMap.set(`${row.warehouseId}:${row.productId}`, Number(row.quantity))
  }

  const enriched = products.map((p) => ({
    ...p,
    stock: p.stock.map((s) => {
      const key = `${s.warehouseId}:${p.id}`
      const reservedOnWarehouse = reservedByWhProduct.get(key) ?? 0
      const physical = Number(s.quantity)
      const freeOnWarehouse = physical - reservedOnWarehouse
      const reservedForSelectedObject = forObjectId ? (reservedForObjectMap.get(key) ?? 0) : 0
      const maxMovableToSelectedObject = forObjectId ? freeOnWarehouse + reservedForSelectedObject : freeOnWarehouse
      return {
        ...s,
        reservedOnWarehouse,
        freeOnWarehouse,
        ...(forObjectId
          ? { reservedForSelectedObject, maxMovableToSelectedObject }
          : {}),
      }
    }),
  }))

  return { products: enriched }
})
