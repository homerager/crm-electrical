import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!

  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          invoices: true,
          movementsFrom: true,
          movementsTo: true,
          objectStockReservations: true,
        },
      },
      stock: { select: { quantity: true } },
    },
  })

  if (!warehouse) {
    throw createError({ statusCode: 404, statusMessage: 'Склад не знайдено' })
  }

  if (warehouse._count.invoices > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Неможливо видалити: до складу привʼязано ${warehouse._count.invoices} накладну(их). Спочатку видаліть накладні.`,
    })
  }

  const movementsCount = warehouse._count.movementsFrom + warehouse._count.movementsTo
  if (movementsCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Неможливо видалити: до складу привʼязано ${movementsCount} переміщення(ь). Спочатку видаліть переміщення.`,
    })
  }

  const hasNonZeroStock = warehouse.stock.some((s) => Number(s.quantity) !== 0)
  if (hasNonZeroStock) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Неможливо видалити: на складі є залишки товарів.',
    })
  }

  if (warehouse._count.objectStockReservations > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Неможливо видалити: на складі є ${warehouse._count.objectStockReservations} резерв(ів) під обʼєкти. Спочатку зніміть резерви.`,
    })
  }

  await prisma.$transaction([
    prisma.warehouseStock.deleteMany({ where: { warehouseId: id } }),
    prisma.warehouse.delete({ where: { id } }),
  ])

  writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'DELETE', entityType: 'Warehouse', entityId: id, changes: { name: warehouse.name } })

  return { ok: true }
})
