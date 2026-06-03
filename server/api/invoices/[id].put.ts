import type { InvoiceType } from '@prisma/client'
import { isElevatedRole } from '../../utils/authz'
import { checkLowStockAfterChange } from '../../utils/lowStockAlert'
import { syncSupplierPricesFromInvoice } from '../../utils/supplierPrices'
import {
  addWarehouseLotQty,
  addObjectLotQty,
  consumeWarehouseFifo,
  consumeObjectFifo,
  reverseWarehouseLot,
  reverseObjectLot,
} from '../../utils/stockLots'

interface InvoiceItemInput {
  productId: string
  quantity: number
  pricePerUnit: number
  vatPercent?: number
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { number, type, contractorId, warehouseId, objectId, date, notes, items } = body

  if (!number || !type || !date || !items?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Заповніть всі обовʼязкові поля' })
  }
  if (!warehouseId && !objectId) {
    throw createError({ statusCode: 400, statusMessage: 'Оберіть склад або обʼєкт' })
  }
  if (warehouseId && objectId) {
    throw createError({ statusCode: 400, statusMessage: 'Оберіть або склад, або обʼєкт' })
  }

  const existing = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Накладну не знайдено' })

  const newContractorId = contractorId || null
  const oldContractorId = existing.contractorId || null

  const invoice = await prisma.$transaction(async (tx) => {
    // 1. Undo the stock effects of the existing invoice version, per lot.
    for (const item of existing.items) {
      const qty = Number(item.quantity)
      const price = Number(item.pricePerUnit)
      const vat = Number(item.vatPercent)

      if (existing.warehouseId) {
        if (existing.type === 'INCOMING') {
          // Was added to the (supplier, price) lot — remove it back.
          await reverseWarehouseLot(tx, existing.warehouseId, item.productId, oldContractorId, price, qty)
        } else {
          // Was consumed (FIFO) — return the quantity to the matching lot.
          await addWarehouseLotQty(tx, existing.warehouseId, item.productId, oldContractorId, price, vat, qty)
        }
        await checkLowStockAfterChange(tx, existing.warehouseId, item.productId)
      } else if (existing.objectId) {
        if (existing.type === 'INCOMING') {
          await reverseObjectLot(tx, existing.objectId, item.productId, oldContractorId, price, qty)
        } else {
          await addObjectLotQty(tx, existing.objectId, item.productId, oldContractorId, price, vat, qty)
        }
      }
    }

    // 2. Apply the stock effects of the new invoice version (same logic as create).
    for (const item of items as InvoiceItemInput[]) {
      const qty = Number(item.quantity)
      const price = item.pricePerUnit || 0
      const vat = item.vatPercent ?? 0

      if (type === 'INCOMING') {
        if (warehouseId) {
          await addWarehouseLotQty(tx, warehouseId, item.productId, newContractorId, price, vat, qty)
          await checkLowStockAfterChange(tx, warehouseId, item.productId)
        } else if (objectId) {
          await addObjectLotQty(tx, objectId, item.productId, newContractorId, price, vat, qty)
        }
      } else {
        if (warehouseId) {
          await consumeWarehouseFifo(tx, warehouseId, item.productId, qty)
          await checkLowStockAfterChange(tx, warehouseId, item.productId)
        } else if (objectId) {
          await consumeObjectFifo(tx, objectId, item.productId, qty)
        }
      }
    }

    // 3. Update the invoice and replace its items.
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })

    return tx.invoice.update({
      where: { id },
      data: {
        number,
        type: type as InvoiceType,
        contractorId: newContractorId,
        warehouseId: warehouseId || null,
        objectId: objectId || null,
        date: new Date(date),
        notes: notes ?? null,
        items: {
          create: (items as InvoiceItemInput[]).map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            pricePerUnit: item.pricePerUnit || 0,
            vatPercent: item.vatPercent ?? 0,
          })),
        },
      },
      include: { items: true },
    })
  })

  writeAuditLog({
    userId: auth!.userId,
    userName: auth!.name,
    action: 'UPDATE',
    entityType: 'Invoice',
    entityId: id,
    changes: { number, type, warehouseId, objectId, contractorId, itemCount: items.length },
  })

  // Record actual purchase prices into supplier price lists (INCOMING only).
  await syncSupplierPricesFromInvoice({
    contractorId: newContractorId,
    type,
    date,
    items: items as InvoiceItemInput[],
    userId: auth!.userId,
    userName: auth!.name,
  })

  return { invoice }
})
