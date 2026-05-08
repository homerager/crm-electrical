import { normalizePurchaseRequestItems } from '../../utils/purchaseRequests'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth!
  const body = await readBody(event)
  const { objectId, contractorId, notes } = body

  if (!objectId) {
    throw createError({ statusCode: 400, statusMessage: 'Оберіть обʼєкт' })
  }

  const object = await prisma.constructionObject.findUnique({ where: { id: objectId } })
  if (!object) throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })
  if (contractorId) {
    const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } })
    if (!contractor) throw createError({ statusCode: 404, statusMessage: 'Контрагента не знайдено' })
  }

  const items = normalizePurchaseRequestItems(body.items)

  const purchaseRequest = await prisma.purchaseRequest.create({
    data: {
      objectId,
      contractorId: contractorId || null,
      createdById: auth.userId,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          estimatedPricePerUnit: item.estimatedPricePerUnit ?? 0,
          vatPercent: item.vatPercent ?? 0,
          note: item.note,
        })),
      },
    },
    include: {
      object: true,
      contractor: true,
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: true } },
    },
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'CREATE',
    entityType: 'PurchaseRequest',
    entityId: purchaseRequest.id,
    changes: { objectId, contractorId: contractorId || null, itemCount: items.length },
  })

  return { purchaseRequest }
})
