import { buildObjectPurchaseNeeds } from '../../utils/purchaseRequests'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth!
  const body = await readBody(event)
  const objectId = typeof body.objectId === 'string' ? body.objectId : ''
  const contractorId = typeof body.contractorId === 'string' && body.contractorId ? body.contractorId : null

  if (!objectId) {
    throw createError({ statusCode: 400, statusMessage: 'Оберіть обʼєкт' })
  }
  if (contractorId) {
    const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } })
    if (!contractor) throw createError({ statusCode: 404, statusMessage: 'Контрагента не знайдено' })
  }

  const needs = await buildObjectPurchaseNeeds(objectId)
  if (!needs.items.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Для цього обʼєкта не знайдено потреб для автоматичного формування заявки',
    })
  }

  const purchaseRequest = await prisma.purchaseRequest.create({
    data: {
      objectId,
      contractorId,
      createdById: auth.userId,
      notes: `Автоматично сформовано з потреб обʼєкта. Орієнтовна сума: ${needs.estimatedTotal.toFixed(2)} грн`,
      items: {
        create: needs.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          estimatedPricePerUnit: item.estimatedPricePerUnit,
          note: `Потреба: ${item.baselineQuantity}; наявно/зарезервовано/у відкритих заявках: ${item.availableQuantity}`,
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
    changes: {
      objectId,
      contractorId,
      generated: true,
      itemCount: needs.items.length,
      estimatedTotal: needs.estimatedTotal,
      budget: needs.budget,
    },
  })

  return {
    purchaseRequest,
    budget: needs.budget,
    estimatedTotal: needs.estimatedTotal,
  }
})
