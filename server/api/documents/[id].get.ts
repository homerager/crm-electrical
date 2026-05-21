import { computeDocumentTotal, DOC_TYPE_FROM_ENUM, type DocumentData } from '../../utils/documentData'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      object: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })
  if (!doc) throw createError({ statusCode: 404, statusMessage: 'Документ не знайдено' })

  const type = DOC_TYPE_FROM_ENUM[doc.type]
  const data = (doc.data ?? {}) as unknown as DocumentData
  const totals = computeDocumentTotal(type, data)

  return {
    document: {
      id: doc.id,
      type,
      number: doc.number,
      date: doc.date,
      objectId: doc.objectId,
      clientId: doc.clientId,
      object: doc.object,
      client: doc.client,
      data,
      notes: doc.notes,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      totals,
    },
  }
})
