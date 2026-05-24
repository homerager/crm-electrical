import { removeInvoicePdfFile } from '../../../utils/invoiceFile'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) throw createError({ statusCode: 404, statusMessage: 'Накладну не знайдено' })
  if (!invoice.pdfStoredAs) return { ok: true }

  const prevStoredAs = invoice.pdfStoredAs
  await prisma.invoice.update({
    where: { id },
    data: { pdfStoredAs: null, pdfFilename: null, pdfMimeType: null, pdfSize: null },
  })
  await removeInvoicePdfFile(prevStoredAs)

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'UPDATE',
    entityType: 'Invoice',
    entityId: id,
    changes: { detachedPdf: invoice.pdfFilename },
  })

  return { ok: true }
})
