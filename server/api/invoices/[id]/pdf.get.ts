import { setResponseHeader } from 'h3'
import { buildInvoicePdfBuffer } from '../../../utils/invoicePdf'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      contractor: true,
      warehouse: true,
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: true } },
    },
  })

  if (!invoice) throw createError({ statusCode: 404, statusMessage: 'Накладну не знайдено' })

  const buffer = await buildInvoicePdfBuffer(invoice)

  const safeNumber = invoice.number.replace(/[^\w.-]+/g, '_')
  const asciiName = `nakladna-${safeNumber}.pdf`
  const utfName = `Накладна-${invoice.number}.pdf`

  const query = getQuery(event)
  const inline = query.inline === '1' || query.inline === 'true'

  setResponseHeader(event, 'content-type', 'application/pdf')
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
