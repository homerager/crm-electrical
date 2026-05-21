
import type { InvoiceType } from '@prisma/client'

interface InvoiceItemInput {
  productId: string
  quantity: number
  pricePerUnit: number
  vatPercent?: number
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth!
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

    for (const item of items as InvoiceItemInput[]) {
      const delta = type === 'INCOMING' ? item.quantity : -item.quantity

      if (warehouseId) {
        const existing = await tx.warehouseStock.findUnique({
          where: { productId_warehouseId: { productId: item.productId, warehouseId } },
        })

        if (existing) {
          const newQty = Number(existing.quantity) + delta
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
      } else if (objectId) {
        const existing = await tx.objectStock.findUnique({
          where: { objectId_productId: { objectId, productId: item.productId } },
        })

        if (existing) {
          const newQty = Number(existing.quantity) + delta
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

    return created
  })

  writeAuditLog({ userId: auth.userId, userName: auth.name, action: 'CREATE', entityType: 'Invoice', entityId: invoice.id, changes: { number, type, warehouseId, objectId, contractorId, itemCount: items.length } })

  return { invoice }
})
