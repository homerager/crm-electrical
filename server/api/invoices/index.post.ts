
import type { InvoiceType } from '@prisma/client'

interface InvoiceItemInput {
  productId: string
  quantity: number
  pricePerUnit: number
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth!
  const body = await readBody(event)
  const { number, type, contractorId, warehouseId, date, notes, items } = body

  if (!number || !type || !warehouseId || !date || !items?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Заповніть всі обовʼязкові поля' })
  }

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        number,
        type: type as InvoiceType,
        contractorId: contractorId || null,
        warehouseId,
        createdById: auth.userId,
        date: new Date(date),
        notes,
        items: {
          create: (items as InvoiceItemInput[]).map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            pricePerUnit: item.pricePerUnit || 0,
          })),
        },
      },
      include: { items: true },
    })

    for (const item of items as InvoiceItemInput[]) {
      const delta = type === 'INCOMING' ? item.quantity : -item.quantity

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
    }

    return created
  })

  return { invoice }
})
