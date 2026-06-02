import { isElevatedRole } from '../../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID обовʼязковий' })

  const session = await prisma.materialInventorySession.findUnique({
    where: { id },
    include: {
      warehouse: { select: { id: true, name: true } },
      startedBy: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, barcode: true, unit: true } },
        },
        orderBy: { product: { name: 'asc' } },
      },
    },
  })

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Сесію інвентаризації не знайдено' })
  }

  const mapItem = (i: typeof session.items[number]) => ({
    productId: i.productId,
    product: i.product,
    expectedQty: Number(i.expectedQty),
    countedQty: i.countedQty === null ? null : Number(i.countedQty),
    diff: i.countedQty === null ? null : Number(i.countedQty) - Number(i.expectedQty),
    scannedAt: i.scannedAt,
  })

  const items = session.items.map(mapItem)

  const counted = items.filter(i => i.countedQty !== null)
  const notCounted = items.filter(i => i.countedQty === null)
  const matched = counted.filter(i => i.diff === 0)
  const shortage = counted.filter(i => (i.diff as number) < 0)
  const surplus = counted.filter(i => (i.diff as number) > 0)

  return {
    session: {
      id: session.id,
      status: session.status,
      warehouseId: session.warehouseId,
      warehouse: session.warehouse,
      startedBy: session.startedBy,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    },
    summary: {
      totalProducts: items.length,
      counted: counted.length,
      notCounted: notCounted.length,
      matched: matched.length,
      shortage: shortage.length,
      surplus: surplus.length,
    },
    matched,
    shortage,
    surplus,
    notCounted,
  }
})
