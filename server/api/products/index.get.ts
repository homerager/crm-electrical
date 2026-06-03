import { getProductSupplyHistory } from '../../utils/productSupplyHistory'

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
      // Stock is per lot (warehouse + product + contractor + price). `id` is a
      // timestamp-prefixed cuid, so ordering by it gives a stable oldest-first (FIFO)
      // sequence used below to distribute reservations across lots.
      stock: {
        include: {
          warehouse: true,
          contractor: { select: { id: true, name: true } },
        },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  const productIds = products.map((p) => p.id)
  const supplyMap = await getProductSupplyHistory(productIds)

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

  const enriched = products.map((p) => {
    // Reservations are tracked at the (warehouse, product) level, not per lot. Distribute
    // the product-level reservation across this product's lots oldest-first (FIFO) so each
    // lot exposes its own free quantity while the per-product totals stay consistent
    // (Σ freeOnWarehouse == physical − reserved). Lots are already ordered by id (FIFO).
    const remainingReserved = new Map<string, number>()
    const remainingReservedForObject = new Map<string, number>()

    const stock = p.stock.map((s) => {
      const key = `${s.warehouseId}:${p.id}`
      if (!remainingReserved.has(key)) {
        remainingReserved.set(key, reservedByWhProduct.get(key) ?? 0)
      }

      const physical = Number(s.quantity)
      const reservedPool = remainingReserved.get(key)!
      const reservedOnWarehouse = Math.min(physical, Math.max(0, reservedPool))
      remainingReserved.set(key, reservedPool - reservedOnWarehouse)
      const freeOnWarehouse = physical - reservedOnWarehouse

      const row: Record<string, unknown> = {
        ...s,
        reservedOnWarehouse,
        freeOnWarehouse,
      }

      if (forObjectId) {
        if (!remainingReservedForObject.has(key)) {
          remainingReservedForObject.set(key, reservedForObjectMap.get(key) ?? 0)
        }
        const objPool = remainingReservedForObject.get(key)!
        const reservedForSelectedObject = Math.min(physical, Math.max(0, objPool))
        remainingReservedForObject.set(key, objPool - reservedForSelectedObject)
        // Stock reserved for the destination object itself can still be moved there.
        row.reservedForSelectedObject = reservedForSelectedObject
        row.maxMovableToSelectedObject = freeOnWarehouse + reservedForSelectedObject
      }

      return row
    })

    return {
      ...p,
      supplyHistory: supplyMap.get(p.id) ?? [],
      stock,
    }
  })

  return { products: enriched }
})
