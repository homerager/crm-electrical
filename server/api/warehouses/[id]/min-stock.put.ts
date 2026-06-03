import { isElevatedRole } from '../../../utils/authz'
import { checkLowStockAfterChange } from '../../../utils/lowStockAlert'
import { sumWarehouseQty } from '../../../utils/stockLots'

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
    const existing = await tx.warehouseProductSetting.findUnique({
      where: { warehouseId_productId: { warehouseId, productId } },
    })

    if (!existing) {
      // Дозволяємо задати мінімум навіть до появи фізичного залишку — створимо налаштування
      if (parsed == null) {
        return null
      }
      await tx.warehouseProductSetting.create({
        data: { productId, warehouseId, minStock: parsed },
      })
    } else {
      // При будь-якому оновленні мінімуму скидаємо дедуплікацію — щоб новий поріг переоцінився чесно
      // і user, що зайшов у діалог, міг ретригернути сповіщення.
      await tx.warehouseProductSetting.update({
        where: { warehouseId_productId: { warehouseId, productId } },
        data: {
          minStock: parsed,
          lowStockNotifiedAt: null,
        },
      })
    }

    if (parsed != null) {
      await checkLowStockAfterChange(tx, warehouseId, productId)
    }

    const setting = await tx.warehouseProductSetting.findUnique({
      where: { warehouseId_productId: { warehouseId, productId } },
    })
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, unit: true, sku: true },
    })
    const quantity = await sumWarehouseQty(tx, warehouseId, productId)

    return setting ? { ...setting, quantity, product } : null
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
