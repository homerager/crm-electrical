import { isElevatedRole } from '../../utils/authz'
import { removeInvoicePdfFile } from '../../utils/invoiceFile'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
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

      if (invoice.warehouseId) {
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
      } else if (invoice.objectId) {
        const stock = await tx.objectStock.findUnique({
          where: { objectId_productId: { objectId: invoice.objectId, productId: item.productId } },
        })

        if (stock) {
          const newQty = Number(stock.quantity) + delta
          await tx.objectStock.update({
            where: { objectId_productId: { objectId: invoice.objectId, productId: item.productId } },
            data: { quantity: Math.max(0, newQty) },
          })
        }
      }
    }

    await tx.invoice.delete({ where: { id } })
  })

  if (invoice.pdfStoredAs) {
    await removeInvoicePdfFile(invoice.pdfStoredAs)
  }

  writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'DELETE', entityType: 'Invoice', entityId: id, changes: { number: invoice.number, type: invoice.type } })

  return { ok: true }
})
