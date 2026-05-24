import { setResponseHeader } from 'h3'
import { readInvoicePdfBuffer } from '../../../utils/invoiceFile'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true, number: true, pdfStoredAs: true, pdfFilename: true, pdfMimeType: true },
  })
  if (!invoice) throw createError({ statusCode: 404, statusMessage: 'Накладну не знайдено' })
  if (!invoice.pdfStoredAs) {
    throw createError({ statusCode: 404, statusMessage: 'PDF не прикріплено' })
  }

  let buffer: Buffer
  try {
    buffer = await readInvoicePdfBuffer(invoice.pdfStoredAs)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Файл PDF не знайдено на диску' })
  }

  const query = getQuery(event)
  const inline = query.inline === '1' || query.inline === 'true'
  const utfName = invoice.pdfFilename || `nakladna-${invoice.number}.pdf`
  const asciiName = `nakladna-${invoice.number.replace(/[^\w.-]+/g, '_')}-attached.pdf`

  setResponseHeader(event, 'content-type', invoice.pdfMimeType || 'application/pdf')
  setResponseHeader(
    event,
    'content-disposition',
    inline
      ? `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utfName)}`
      : `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utfName)}`,
  )
  setResponseHeader(event, 'cache-control', 'private, no-cache')
  return buffer
})
