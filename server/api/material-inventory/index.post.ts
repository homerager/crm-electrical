import { requirePermission } from '../../utils/authz'
import { emptyToNull } from '../../utils/strings'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'inventory.manage')

  const body = await readBody(event)
  const wh = emptyToNull(body?.warehouseId)

  if (!wh) {
    throw createError({ statusCode: 400, statusMessage: 'Оберіть склад для інвентаризації' })
  }

  const warehouse = await prisma.warehouse.findUnique({ where: { id: wh }, select: { id: true } })
  if (!warehouse) {
    throw createError({ statusCode: 404, statusMessage: 'Склад не знайдено' })
  }

  const existingActive = await prisma.materialInventorySession.findFirst({
    where: { status: 'IN_PROGRESS', warehouseId: wh },
  })
  if (existingActive) {
    throw createError({ statusCode: 409, statusMessage: 'Для цього складу вже є активна сесія інвентаризації матеріалів' })
  }

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.materialInventorySession.create({
      data: {
        warehouseId: wh,
        startedById: auth.userId,
      },
      include: {
        warehouse: { select: { id: true, name: true } },
        startedBy: { select: { id: true, name: true } },
      },
    })

    // Stock is per lot (supplier + price); the inventory item is per product, so sum lots per product.
    const stockByProduct = await tx.warehouseStock.groupBy({
      by: ['productId'],
      where: { warehouseId: wh },
      _sum: { quantity: true },
    })

    if (stockByProduct.length > 0) {
      await tx.materialInventoryItem.createMany({
        data: stockByProduct.map(s => ({
          sessionId: created.id,
          productId: s.productId,
          expectedQty: s._sum.quantity ?? 0,
        })),
      })
    }

    return created
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'CREATE',
    entityType: 'MaterialInventorySession',
    entityId: session.id,
    changes: { warehouseId: wh },
  })

  return { session }
})
