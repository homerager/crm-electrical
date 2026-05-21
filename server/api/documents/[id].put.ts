import { DOC_TYPE_FROM_ENUM, normalizeDocumentData } from '../../utils/documentData'

interface RequestBody {
  number?: string
  date?: string
  notes?: string | null
  data?: any
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody<RequestBody>(event)

  const existing = await prisma.document.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Документ не знайдено' })

  if (body.number != null && !String(body.number).trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Номер документа не може бути порожнім' })
  }

  const type = DOC_TYPE_FROM_ENUM[existing.type]
  const data = body.data !== undefined
    ? normalizeDocumentData(type, body.data)
    : undefined

  const document = await prisma.document.update({
    where: { id },
    data: {
      ...(body.number != null ? { number: String(body.number).trim() } : {}),
      ...(body.date ? { date: new Date(body.date) } : {}),
      ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes) : null } : {}),
      ...(data !== undefined ? { data: data as unknown as object } : {}),
    },
  })

  return { document }
})
