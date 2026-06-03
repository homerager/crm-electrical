import type { MovementType } from '@prisma/client'
import { consumeReservationForShipment, freeQtyOnWarehouse } from '../../utils/warehouseReservations'
import { checkLowStockAfterChange } from '../../utils/lowStockAlert'
import { addObjectLotQty, addWarehouseLotQty, decObjectLotQty, decWarehouseLotQty } from '../../utils/stockLots'

const EPS = 1e-9

/**
 * One movement line now identifies an exact stock lot — (product, contractor, price) —
 * not just a product. `vatPercent` is carried so destination lots can be created with the
 * right attribute. The lot dims are also persisted onto the resulting MovementItem.
 */
interface MovementItemInput {
  productId: string
  contractorId?: string | null
  pricePerUnit?: number | string
  vatPercent?: number | string
  quantity: number
}

function parsePositiveQty(raw: unknown): number {
  const q = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(q) || q <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Кількість має бути більшою за 0' })
  }
  return q
}

/** Parses an optional numeric lot dimension (price / vat), defaulting to 0 for legacy lots. */
function parseLotNumber(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : 0
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth!
  const body = await readBody(event)
  const { type, fromWarehouseId, toWarehouseId, objectId, date, notes, items } = body

  if (!type || !date || !items?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Заповніть всі обовʼязкові поля' })
  }

  const normalizedItems = (items as MovementItemInput[]).map((i) => ({
    productId: i.productId,
    contractorId: i.contractorId ?? null,
    pricePerUnit: parseLotNumber(i.pricePerUnit),
    vatPercent: parseLotNumber(i.vatPercent),
    quantity: parsePositiveQty(i.quantity),
  }))

  const itemCreateData = normalizedItems.map((i) => ({
    productId: i.productId,
    contractorId: i.contractorId,
    pricePerUnit: i.pricePerUnit,
    vatPercent: i.vatPercent,
    quantity: i.quantity,
  }))

  if (type === 'WAREHOUSE_TO_WAREHOUSE' || type === 'WAREHOUSE_TO_OBJECT') {
    if (!fromWarehouseId) {
      throw createError({ statusCode: 400, statusMessage: 'Оберіть склад відправлення' })
    }
    if (type === 'WAREHOUSE_TO_WAREHOUSE' && !toWarehouseId) {
      throw createError({ statusCode: 400, statusMessage: 'Оберіть склад призначення' })
    }
    if (type === 'WAREHOUSE_TO_OBJECT' && !objectId) {
      throw createError({ statusCode: 400, statusMessage: 'Оберіть обʼєкт призначення' })
    }

    const movement = await prisma.$transaction(async (tx) => {
      for (const item of normalizedItems) {
        if (type === 'WAREHOUSE_TO_WAREHOUSE') {
          // Reservations are product-level: don't let a move dip into reserved stock.
          const free = await freeQtyOnWarehouse(tx, fromWarehouseId, item.productId)
          if (item.quantity > free + EPS) {
            const product = await tx.product.findUnique({ where: { id: item.productId } })
            throw createError({
              statusCode: 400,
              statusMessage: `Частина товару "${product?.name}" зарезервована під обʼєкти. Вільно для переміщення: ${Math.max(0, free)}`,
            })
          }
        }

        if (type === 'WAREHOUSE_TO_OBJECT' && objectId) {
          await consumeReservationForShipment(tx, objectId, fromWarehouseId, item.productId, item.quantity)
        }

        // Decrement the exact source lot the user picked (validates lot-level availability).
        await decWarehouseLotQty(tx, fromWarehouseId, item.productId, item.contractorId, item.pricePerUnit, item.quantity)
        await checkLowStockAfterChange(tx, fromWarehouseId, item.productId)

        if (type === 'WAREHOUSE_TO_WAREHOUSE' && toWarehouseId) {
          // Mirror the lot onto the destination warehouse (same supplier + price + vat).
          await addWarehouseLotQty(tx, toWarehouseId, item.productId, item.contractorId, item.pricePerUnit, item.vatPercent, item.quantity)
          await checkLowStockAfterChange(tx, toWarehouseId, item.productId)
        }

        if (type === 'WAREHOUSE_TO_OBJECT' && objectId) {
          await addObjectLotQty(tx, objectId, item.productId, item.contractorId, item.pricePerUnit, item.vatPercent, item.quantity)
        }
      }

      return tx.movement.create({
        data: {
          type: type as MovementType,
          fromWarehouseId,
          toWarehouseId: type === 'WAREHOUSE_TO_WAREHOUSE' ? toWarehouseId : null,
          objectId: type === 'WAREHOUSE_TO_OBJECT' ? objectId : null,
          createdById: auth.userId,
          date: new Date(date),
          notes,
          items: { create: itemCreateData },
        },
        include: { items: true },
      })
    })

    writeAuditLog({ userId: auth.userId, userName: auth.name, action: 'CREATE', entityType: 'Movement', entityId: movement.id, changes: { type, fromWarehouseId, toWarehouseId, objectId, itemCount: normalizedItems.length } })

    return { movement }
  }

  if (type === 'OBJECT_WRITE_OFF') {
    if (!objectId) {
      throw createError({ statusCode: 400, statusMessage: 'Оберіть обʼєкт' })
    }

    const movement = await prisma.$transaction(async (tx) => {
      for (const item of normalizedItems) {
        // Write off the exact object lot the user picked (exact cost = lot price).
        await decObjectLotQty(tx, objectId, item.productId, item.contractorId, item.pricePerUnit, item.quantity)
      }

      return tx.movement.create({
        data: {
          type: 'OBJECT_WRITE_OFF',
          fromWarehouseId: null,
          toWarehouseId: null,
          objectId,
          createdById: auth.userId,
          date: new Date(date),
          notes,
          items: { create: itemCreateData },
        },
        include: { items: true },
      })
    })

    writeAuditLog({ userId: auth.userId, userName: auth.name, action: 'CREATE', entityType: 'Movement', entityId: movement.id, changes: { type: 'OBJECT_WRITE_OFF', objectId, itemCount: normalizedItems.length } })

    return { movement }
  }

  if (type === 'OBJECT_TO_WAREHOUSE') {
    if (!objectId) {
      throw createError({ statusCode: 400, statusMessage: 'Оберіть обʼєкт' })
    }
    if (!toWarehouseId) {
      throw createError({ statusCode: 400, statusMessage: 'Оберіть склад для повернення' })
    }

    const movement = await prisma.$transaction(async (tx) => {
      for (const item of normalizedItems) {
        // Return the exact object lot back to the warehouse as the matching lot.
        await decObjectLotQty(tx, objectId, item.productId, item.contractorId, item.pricePerUnit, item.quantity)
        await addWarehouseLotQty(tx, toWarehouseId, item.productId, item.contractorId, item.pricePerUnit, item.vatPercent, item.quantity)
        await checkLowStockAfterChange(tx, toWarehouseId, item.productId)
      }

      return tx.movement.create({
        data: {
          type: 'OBJECT_TO_WAREHOUSE',
          fromWarehouseId: null,
          toWarehouseId,
          objectId,
          createdById: auth.userId,
          date: new Date(date),
          notes,
          items: { create: itemCreateData },
        },
        include: { items: true },
      })
    })

    writeAuditLog({ userId: auth.userId, userName: auth.name, action: 'CREATE', entityType: 'Movement', entityId: movement.id, changes: { type: 'OBJECT_TO_WAREHOUSE', objectId, toWarehouseId, itemCount: normalizedItems.length } })

    return { movement }
  }

  throw createError({ statusCode: 400, statusMessage: 'Невідомий тип переміщення' })
})
