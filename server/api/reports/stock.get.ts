import { getProductSupplyHistory, attachSupplyHistory } from '../../utils/productSupplyHistory'

export default defineEventHandler(async () => {
  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    include: {
      // Stock is tracked per lot (warehouse + product + contractor + price), so each
      // row here is one lot. Carry the lot's contractor/price/vat so the report can
      // show exact supplier and cost per row.
      stock: {
        include: {
          product: true,
          contractor: { select: { id: true, name: true } },
        },
        where: { quantity: { gt: 0 } },
        orderBy: [{ product: { name: 'asc' } }, { pricePerUnit: 'asc' }],
      },
    },
    orderBy: { name: 'asc' },
  })

  const allProductIds = [...new Set(warehouses.flatMap((w) => w.stock.map((s) => s.productId)))]
  const supplyMap = await getProductSupplyHistory(allProductIds)

  const enriched = warehouses.map((w) => ({
    ...w,
    stock: attachSupplyHistory(w.stock, supplyMap),
  }))

  return { warehouses: enriched }
})
