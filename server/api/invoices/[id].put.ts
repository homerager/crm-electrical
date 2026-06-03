import type { InvoiceType } from '@prisma/client'
import { isElevatedRole } from '../../utils/authz'
import { checkLowStockAfterChange } from '../../utils/lowStockAlert'
import { syncSupplierPricesFromInvoice } from '../../utils/supplierPrices'

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

  const invoice = await prisma.$transaction(async (tx) => {
    // 1. Відкат складських ефектів старої накладної
    for (const item of existing.items) {
      const delta = existing.type === 'INCOMING' ? -Number(item.quantity) : Number(item.quantity)

      if (existing.warehouseId) {
        const stock = await tx.warehouseStock.findUnique({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: existing.warehouseId } },
        })
        if (stock) {
          await tx.warehouseStock.update({
            where: { productId_warehouseId: { productId: item.productId, warehouseId: existing.warehouseId } },
            data: { quantity: Math.max(0, Number(stock.quantity) + delta) },
          })
          await checkLowStockAfterChange(tx, existing.warehouseId, item.productId)
        }
      } else if (existing.objectId) {
        const stock = await tx.objectStock.findUnique({
          where: { objectId_productId: { objectId: existing.objectId, productId: item.productId } },
        })
        if (stock) {
          await tx.objectStock.update({
            where: { objectId_productId: { objectId: existing.objectId, productId: item.productId } },
            data: { quantity: Math.max(0, Number(stock.quantity) + delta) },
          })
        }
      }
    }

    // 2. Застосування складських ефектів нової версії накладної
    for (const item of items as InvoiceItemInput[]) {
      const delta = type === 'INCOMING' ? item.quantity : -item.quantity

      if (warehouseId) {
        const stock = await tx.warehouseStock.findUnique({
          where: { productId_warehouseId: { productId: item.productId, warehouseId } },
        })
        if (stock) {
          const newQty = Number(stock.quantity) + delta
          if (newQty < 0) {
            throw createError({ statusCode: 400, statusMessage: 'Недостатньо товару на складі' })
          }
          await tx.warehouseStock.update({
            where: { productId_warehouseId: { productId: item.productId, warehouseId } },
            data: { quantity: newQty },
          })
        } else {
          if (delta < 0) {
            throw createError({ statusCode: 400, statusMessage: 'Недостатньо товару на складі' })
          }
          await tx.warehouseStock.create({
            data: { productId: item.productId, warehouseId, quantity: delta },
          })
        }
        await checkLowStockAfterChange(tx, warehouseId, item.productId)
      } else if (objectId) {
        const stock = await tx.objectStock.findUnique({
          where: { objectId_productId: { objectId, productId: item.productId } },
        })
        if (stock) {
          const newQty = Number(stock.quantity) + delta
          if (newQty < 0) {
            throw createError({ statusCode: 400, statusMessage: 'Недостатньо товару на обʼєкті' })
          }
          await tx.objectStock.update({
            where: { objectId_productId: { objectId, productId: item.productId } },
            data: { quantity: newQty },
          })
        } else {
          if (delta < 0) {
            throw createError({ statusCode: 400, statusMessage: 'Недостатньо товару на обʼєкті' })
          }
          await tx.objectStock.create({
            data: { objectId, productId: item.productId, quantity: delta },
          })
        }
      }
    }

    // 3. Оновлення накладної та заміна позицій
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })

    return tx.invoice.update({
      where: { id },
      data: {
        number,
        type: type as InvoiceType,
        contractorId: contractorId || null,
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
    contractorId: contractorId || null,
    type,
    date,
    items: items as InvoiceItemInput[],
    userId: auth!.userId,
    userName: auth!.name,
  })

  return { invoice }
})
