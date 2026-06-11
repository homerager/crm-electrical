
import type { InvoiceType } from '@prisma/client'
import { checkLowStockAfterChange } from '../../utils/lowStockAlert'
import { syncSupplierPricesFromInvoice } from '../../utils/supplierPrices'
import {
  addWarehouseLotQty,
  addObjectLotQty,
  consumeWarehouseFifo,
  consumeObjectFifo,
} from '../../utils/stockLots'

interface InvoiceItemInput {
  productId: string
  quantity: number
  pricePerUnit: number
  vatPercent?: number
}

/** Coerces a form value (often a string from <input type="number">) to a positive quantity. */
function parsePositiveQty(raw: unknown): number {
  const q = Number(raw)
  if (!Number.isFinite(q) || q <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Кількість має бути більшою за 0' })
  }
  return q
}

/** Coerces an optional numeric field (price / vat), defaulting to 0. */
function parseNumber(raw: unknown): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth!
  const body = await readBody(event)
  const { number, type, contractorId, warehouseId, objectId, date, notes, items: rawItems, pdf } = body

  if (!number || !type || !date || !rawItems?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Заповніть всі обовʼязкові поля' })
  }
  if (!warehouseId && !objectId) {
    throw createError({ statusCode: 400, statusMessage: 'Оберіть склад або обʼєкт' })
  }
  if (warehouseId && objectId) {
    throw createError({ statusCode: 400, statusMessage: 'Оберіть або склад, або обʼєкт' })
  }

  // Normalise numeric fields up front — the form sends them as strings, and the lot helpers
  // require real numbers (Number.isFinite rejects numeric strings).
  const items: InvoiceItemInput[] = (rawItems as InvoiceItemInput[]).map((item) => ({
    productId: item.productId,
    quantity: parsePositiveQty(item.quantity),
    pricePerUnit: parseNumber(item.pricePerUnit),
    vatPercent: parseNumber(item.vatPercent),
  }))

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        number,
        type: type as InvoiceType,
        contractorId: contractorId || null,
        warehouseId: warehouseId || null,
        objectId: objectId || null,
        createdById: auth.userId,
        date: new Date(date),
        notes,
        pdfStoredAs: pdf?.storedAs ?? null,
        pdfFilename: pdf?.filename ?? null,
        pdfMimeType: pdf?.mimeType ?? null,
        pdfSize: pdf?.size ?? null,
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

    const lotContractorId = contractorId || null

    for (const item of items as InvoiceItemInput[]) {
      if (type === 'INCOMING') {
        // Intake merges into the lot keyed by (location, product, supplier, unit price);
        // vatPercent is stored as a lot attribute (set on first creation of the lot).
        if (warehouseId) {
          await addWarehouseLotQty(
            tx,
            warehouseId,
            item.productId,
            lotContractorId,
            item.pricePerUnit || 0,
            item.vatPercent ?? 0,
            item.quantity,
          )
          await checkLowStockAfterChange(tx, warehouseId, item.productId)
        } else if (objectId) {
          await addObjectLotQty(
            tx,
            objectId,
            item.productId,
            lotContractorId,
            item.pricePerUnit || 0,
            item.vatPercent ?? 0,
            item.quantity,
          )
        }
      } else {
        // OUTGOING: a sale price can't identify a cost lot, so consume oldest lots first (FIFO).
        if (warehouseId) {
          await consumeWarehouseFifo(tx, warehouseId, item.productId, item.quantity)
          await checkLowStockAfterChange(tx, warehouseId, item.productId)
        } else if (objectId) {
          await consumeObjectFifo(tx, objectId, item.productId, item.quantity)
        }
      }
    }

    return created
  })

  writeAuditLog({ userId: auth.userId, userName: auth.name, action: 'CREATE', entityType: 'Invoice', entityId: invoice.id, changes: { number, type, warehouseId, objectId, contractorId, itemCount: items.length } })

  // Record actual purchase prices into supplier price lists (INCOMING only).
  await syncSupplierPricesFromInvoice({
    contractorId: contractorId || null,
    type,
    date,
    items: items as InvoiceItemInput[],
    userId: auth.userId,
    userName: auth.name,
  })

  return { invoice }
})
