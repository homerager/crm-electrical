import { requirePermission } from '../../utils/authz'
import { removeInvoicePdfFile } from '../../utils/invoiceFile'
import { checkLowStockAfterChange } from '../../utils/lowStockAlert'
import {
  addWarehouseLotQty,
  addObjectLotQty,
  reverseWarehouseLot,
  reverseObjectLot,
} from '../../utils/stockLots'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth

  await requirePermission(event, 'invoices.delete')

  const id = getRouterParam(event, 'id')!

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!invoice) throw createError({ statusCode: 404, statusMessage: 'Накладну не знайдено' })

  const contractorId = invoice.contractorId || null

  await prisma.$transaction(async (tx) => {
    // Undo the invoice's stock effects per lot (supplier + price).
    for (const item of invoice.items) {
      const qty = Number(item.quantity)
      const price = Number(item.pricePerUnit)
      const vat = Number(item.vatPercent)

      if (invoice.warehouseId) {
        if (invoice.type === 'INCOMING') {
          // Intake added to the (supplier, price) lot — remove it back.
          await reverseWarehouseLot(tx, invoice.warehouseId, item.productId, contractorId, price, qty)
        } else {
          // Outgoing consumed stock — return the quantity to the matching lot.
          await addWarehouseLotQty(tx, invoice.warehouseId, item.productId, contractorId, price, vat, qty)
        }
        await checkLowStockAfterChange(tx, invoice.warehouseId, item.productId)
      } else if (invoice.objectId) {
        if (invoice.type === 'INCOMING') {
          await reverseObjectLot(tx, invoice.objectId, item.productId, contractorId, price, qty)
        } else {
          await addObjectLotQty(tx, invoice.objectId, item.productId, contractorId, price, vat, qty)
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
