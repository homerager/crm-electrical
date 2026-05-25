import { getProductSupplyHistory, attachSupplyHistory } from '../../utils/productSupplyHistory'

export default defineEventHandler(async () => {
  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    include: {
      stock: {
        include: { product: true },
        where: {
          OR: [
            { quantity: { gt: 0 } },
            { minStock: { not: null } },
          ],
        },
        orderBy: { product: { name: 'asc' } },
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
