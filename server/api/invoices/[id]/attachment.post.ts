import { MAX_INVOICE_PDF_SIZE, buildStoredInvoicePdfName, writeInvoicePdfBuffer, removeInvoicePdfFile } from '../../../utils/invoiceFile'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) throw createError({ statusCode: 404, statusMessage: 'Накладну не знайдено' })

  const parts = await readMultipartFormData(event)
  const part = parts?.find((p) => p.filename && p.data)
  if (!part || !part.data || !part.filename) {
    throw createError({ statusCode: 400, statusMessage: 'PDF файл не отримано' })
  }
  if (part.data.length > MAX_INVOICE_PDF_SIZE) {
    throw createError({ statusCode: 413, statusMessage: 'PDF перевищує ліміт 25 МБ' })
  }
  const mime = part.type || 'application/pdf'
  if (!mime.includes('pdf')) {
    throw createError({ statusCode: 400, statusMessage: 'Очікується PDF файл' })
  }

  const storedAs = buildStoredInvoicePdfName(part.filename)
  await writeInvoicePdfBuffer(storedAs, part.data)

  const prevStoredAs = invoice.pdfStoredAs
  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      pdfStoredAs: storedAs,
      pdfFilename: part.filename,
      pdfMimeType: mime,
      pdfSize: part.data.length,
    },
  })

  if (prevStoredAs && prevStoredAs !== storedAs) {
    await removeInvoicePdfFile(prevStoredAs)
  }

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'UPDATE',
    entityType: 'Invoice',
    entityId: id,
    changes: { attachedPdf: part.filename },
  })

  return {
    invoice: {
      id: updated.id,
      pdfStoredAs: updated.pdfStoredAs,
      pdfFilename: updated.pdfFilename,
      pdfMimeType: updated.pdfMimeType,
      pdfSize: updated.pdfSize,
    },
  }
})
