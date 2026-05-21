import { setResponseHeader } from 'h3'
import { buildEstimatePdf, buildActPdf, buildContractPdf } from '../../../utils/documentPdf'
import { DOC_TYPE_FROM_ENUM, type DocumentData } from '../../../utils/documentData'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc) throw createError({ statusCode: 404, statusMessage: 'Документ не знайдено' })

  const type = DOC_TYPE_FROM_ENUM[doc.type]
  const data = (doc.data ?? {}) as unknown as DocumentData
  const dateStr = doc.date.toISOString()

  let buffer: Buffer
  let asciiName: string
  let utfName: string
  const safeNumber = doc.number.replace(/[^\w.-]+/g, '_')

  if (type === 'estimate') {
    buffer = await buildEstimatePdf({
      object: data.object,
      client: data.client,
      materials: data.materials ?? [],
      labor: data.labor ?? [],
      number: doc.number,
      date: dateStr,
      vatPercent: data.vatPercent ?? 0,
      notes: doc.notes ?? undefined,
    })
    asciiName = `koshtorys-${safeNumber}.pdf`
    utfName = `Кошторис-${doc.number}.pdf`
  } else if (type === 'act') {
    buffer = await buildActPdf({
      object: data.object,
      client: data.client,
      materials: data.materials ?? [],
      labor: data.labor ?? [],
      number: doc.number,
      date: dateStr,
      periodFrom: data.periodFrom ?? undefined,
      periodTo: data.periodTo ?? undefined,
      vatPercent: data.vatPercent ?? 0,
      notes: doc.notes ?? undefined,
    })
    asciiName = `akt-${safeNumber}.pdf`
    utfName = `Акт-${doc.number}.pdf`
  } else {
    if (!data.client) {
      throw createError({ statusCode: 400, statusMessage: 'У договорі не вказано замовника' })
    }
    buffer = await buildContractPdf({
      object: data.object,
      client: data.client,
      number: doc.number,
      date: dateStr,
      totalAmount: data.totalAmount ?? 0,
      prepaymentPercent: data.prepaymentPercent ?? undefined,
      warrantyMonths: data.warrantyMonths ?? undefined,
      vatPercent: data.vatPercent ?? 0,
      notes: doc.notes ?? undefined,
    })
    asciiName = `dohovir-${safeNumber}.pdf`
    utfName = `Договір-${doc.number}.pdf`
  }

  const query = getQuery(event)
  const inline = query.inline === '1' || query.inline === 'true'

  setResponseHeader(event, 'content-type', 'application/pdf')
  setResponseHeader(
    event,
    'content-disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utfName)}`,
  )
  setResponseHeader(event, 'cache-control', 'private, no-cache')

  return buffer
})
