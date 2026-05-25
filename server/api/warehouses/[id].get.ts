import { getProductSupplyHistory, attachSupplyHistory } from '../../utils/productSupplyHistory'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
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
  })

  if (!warehouse) throw createError({ statusCode: 404, statusMessage: 'Склад не знайдено' })

  const productIds = warehouse.stock.map((s) => s.productId)
  const supplyMap = await getProductSupplyHistory(productIds, id)

  return {
    warehouse: {
      ...warehouse,
      stock: attachSupplyHistory(warehouse.stock, supplyMap),
    },
  }
})
