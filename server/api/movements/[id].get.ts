import { getProductSupplyHistory, attachSupplyHistory } from '../../utils/productSupplyHistory'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const movement = await prisma.movement.findUnique({
    where: { id },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      object: true,
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: true } },
    },
  })

  if (!movement) throw createError({ statusCode: 404, statusMessage: 'Переміщення не знайдено' })

  const productIds = movement.items.map((i) => i.productId)
  const warehouseId = movement.fromWarehouseId ?? movement.toWarehouseId ?? undefined
  const supplyMap = await getProductSupplyHistory(productIds, warehouseId)

  return {
    movement: {
      ...movement,
      items: attachSupplyHistory(movement.items, supplyMap),
    },
  }
})
