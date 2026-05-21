import { computeDocumentTotal, DOC_TYPE_FROM_ENUM, type DocumentData } from '../../utils/documentData'

export default defineEventHandler(async () => {
  const documents = await prisma.document.findMany({
    include: {
      object: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const enriched = documents.map((d) => {
    const type = DOC_TYPE_FROM_ENUM[d.type]
    const data = (d.data ?? {}) as unknown as DocumentData
    const { total } = computeDocumentTotal(type, data)
    return {
      id: d.id,
      type,
      number: d.number,
      date: d.date,
      objectName: d.object?.name ?? (data.object?.name ?? null),
      clientName: d.client?.name ?? (data.client?.name ?? null),
      notes: d.notes,
      createdBy: d.createdBy,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      total,
    }
  })

  return { documents: enriched }
})
