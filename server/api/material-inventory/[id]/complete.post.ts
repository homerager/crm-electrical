import { isElevatedRole } from '../../../utils/authz'
import { checkLowStockAfterChange } from '../../../utils/lowStockAlert'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

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

        const existing = await tx.warehouseStock.findUnique({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: session.warehouseId } },
          select: { quantity: true },
        })
        const from = existing ? Number(existing.quantity) : 0

        await tx.warehouseStock.upsert({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: session.warehouseId } },
          update: { quantity: counted },
          create: { productId: item.productId, warehouseId: session.warehouseId, quantity: counted },
        })

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
