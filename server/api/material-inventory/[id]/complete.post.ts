import { requirePermission } from '../../../utils/authz'
import { checkLowStockAfterChange } from '../../../utils/lowStockAlert'
import { sumWarehouseQty, addWarehouseLotQty, consumeWarehouseFifo } from '../../../utils/stockLots'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'inventory.manage')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID обовʼязковий' })

  const body = await readBody(event).catch(() => ({}))
  // За замовчуванням приводимо залишки на складі до фактично порахованих значень
  const applyAdjustments = body?.applyAdjustments !== false

  const session = await prisma.materialInventorySession.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Сесію інвентаризації не знайдено' })
  }
  if (session.status === 'COMPLETED') {
    throw createError({ statusCode: 400, statusMessage: 'Сесія вже завершена' })
  }

  const adjustments: { productId: string; from: number; to: number }[] = []

  const updated = await prisma.$transaction(async (tx) => {
    if (applyAdjustments) {
      for (const item of session.items) {
        if (item.countedQty === null) continue
        const counted = Number(item.countedQty)
        const expected = Number(item.expectedQty)
        if (counted === expected) continue

        // Stock is per lot now; reconcile the product's TOTAL across lots to the counted value.
        const from = await sumWarehouseQty(tx, session.warehouseId, item.productId)
        const delta = counted - from
        if (delta > 0) {
          // Surplus of unknown origin → record as a legacy adjustment lot (no supplier, price 0).
          await addWarehouseLotQty(tx, session.warehouseId, item.productId, null, 0, 0, delta)
        } else if (delta < 0) {
          // Shortage → remove oldest lots first (FIFO). Bounded by `from`, so it cannot underflow.
          await consumeWarehouseFifo(tx, session.warehouseId, item.productId, -delta)
        }

        await checkLowStockAfterChange(tx, session.warehouseId, item.productId)

        adjustments.push({ productId: item.productId, from, to: counted })
      }
    }

    return tx.materialInventorySession.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
      include: {
        warehouse: { select: { id: true, name: true } },
        startedBy: { select: { id: true, name: true } },
      },
    })
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'UPDATE',
    entityType: 'MaterialInventorySession',
    entityId: id,
    changes: { action: 'complete', applyAdjustments, adjustments },
  })

  return { session: updated, adjustments }
})
