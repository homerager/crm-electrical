import { isElevatedRole } from '../../../utils/authz'
import { checkLowStockAfterChange } from '../../../utils/lowStockAlert'

/**
 * Встановити (або зняти) мінімальний залишок для пари (warehouseId, productId).
 *
 * Body: { productId: string, minStock: number | null }
 *  - minStock = null або 0 → знімає контроль і скидає lowStockNotifiedAt
 *  - minStock > 0 → встановлює поріг; перевіряє чи поточний quantity нижче — і шле сповіщення
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role) && auth?.role !== 'STOREKEEPER') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const warehouseId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { productId, minStock } = body ?? {}

  if (!productId || typeof productId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'productId обовʼязковий' })
  }

  let parsed: number | null = null
  if (minStock !== null && minStock !== undefined && minStock !== '') {
    const n = typeof minStock === 'number' ? minStock : Number(String(minStock).replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Некоректне значення мінімального залишку' })
    }
    parsed = n > 0 ? n : null
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.warehouseStock.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    })

    if (!existing) {
      // Дозволяємо задати мінімум навіть до появи фізичного залишку — створимо рядок з quantity=0
      if (parsed == null) {
        return null
      }
      await tx.warehouseStock.create({
        data: { productId, warehouseId, quantity: 0, minStock: parsed },
      })
    } else {
      // При будь-якому оновленні мінімуму скидаємо дедуплікацію — щоб новий поріг переоцінився чесно
      // і user, що зайшов у діалог, міг ретригернути сповіщення.
      await tx.warehouseStock.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: {
          minStock: parsed,
          lowStockNotifiedAt: null,
        },
      })
    }

    if (parsed != null) {
      await checkLowStockAfterChange(tx, warehouseId, productId)
    }

    return tx.warehouseStock.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
      include: { product: { select: { id: true, name: true, unit: true, sku: true } } },
    })
  })

  writeAuditLog({
    userId: auth!.userId,
    userName: auth!.name,
    action: 'UPDATE',
    entityType: 'Warehouse',
    entityId: warehouseId,
    changes: { minStock: { productId, value: parsed } },
  })

  return { stock: updated }
})
