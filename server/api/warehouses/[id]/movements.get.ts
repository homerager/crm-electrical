import { getProductSupplyHistory, attachSupplyHistory } from '../../../utils/productSupplyHistory'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const query = getQuery(event)
  const direction = query.direction as 'in' | 'out' | undefined

  const whereIn = { toWarehouseId: id }
  const whereOut = { fromWarehouseId: id }

  const where =
    direction === 'in' ? whereIn :
    direction === 'out' ? whereOut :
    { OR: [whereIn, whereOut] }

  const movements = await prisma.movement.findMany({
    where,
    include: {
      fromWarehouse: { select: { id: true, name: true } },
      toWarehouse: { select: { id: true, name: true } },
      object: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
        },
      },
    },
    orderBy: { date: 'desc' },
  })

  const allProductIds = [...new Set(movements.flatMap((m) => m.items.map((i) => i.productId)))]
  const supplyMap = await getProductSupplyHistory(allProductIds, id)

  const enriched = movements.map((m) => ({
    ...m,
    items: attachSupplyHistory(m.items, supplyMap),
  }))

  return { movements: enriched }
})
