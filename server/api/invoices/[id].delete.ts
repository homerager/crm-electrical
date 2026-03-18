import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (auth?.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!invoice) throw createError({ statusCode: 404, statusMessage: 'Накладну не знайдено' })

  await prisma.$transaction(async (tx) => {
    for (const item of invoice.items) {
      const delta = invoice.type === 'INCOMING' ? -Number(item.quantity) : Number(item.quantity)

      const stock = await tx.warehouseStock.findUnique({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: invoice.warehouseId } },
      })

      if (stock) {
        const newQty = Number(stock.quantity) + delta
        await tx.warehouseStock.update({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: invoice.warehouseId } },
          data: { quantity: Math.max(0, newQty) },
        })
      }
    }

    await tx.invoice.delete({ where: { id } })
  })

  return { ok: true }
})
