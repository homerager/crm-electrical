import { MAX_INVOICE_PDF_SIZE, buildStoredInvoicePdfName, writeInvoicePdfBuffer, removeInvoicePdfFile } from '../../utils/invoiceFile'
import { parseInvoicePdf } from '../../utils/invoicePdfParser'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Файл не отримано' })
  }
  const part = parts.find((p) => p.filename && p.data)
  if (!part || !part.data || !part.filename) {
    throw createError({ statusCode: 400, statusMessage: 'PDF файл не знайдено у запиті' })
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

  try {
    const parsed = await parseInvoicePdf(part.data)
    return {
      file: {
        storedAs,
        filename: part.filename,
        mimeType: mime,
        size: part.data.length,
      },
      parsed,
    }
  } catch (e: any) {
    // remove stored file if parsing crashed unexpectedly
    await removeInvoicePdfFile(storedAs)
    throw createError({ statusCode: 400, statusMessage: e?.message || 'Не вдалося розпарсити PDF' })
  }
})
