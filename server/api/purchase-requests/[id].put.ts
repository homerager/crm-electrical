import type { PurchaseRequestStatus } from '@prisma/client'
import { normalizePurchaseRequestItems } from '../../utils/purchaseRequests'

const STATUS_VALUES: PurchaseRequestStatus[] = ['DRAFT', 'APPROVED', 'ORDERED', 'RECEIVED']

export default defineEventHandler(async (event) => {
  const auth = event.context.auth!
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const existing = await prisma.purchaseRequest.findUnique({ where: { id }, include: { items: true } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Заявку не знайдено' })
  if (existing.status === 'RECEIVED') {
    throw createError({ statusCode: 400, statusMessage: 'Отриману заявку не можна редагувати' })
  }

  const nextStatus = body.status as PurchaseRequestStatus | undefined
  if (nextStatus && !STATUS_VALUES.includes(nextStatus)) {
    throw createError({ statusCode: 400, statusMessage: 'Невідомий статус заявки' })
  }
  if (nextStatus === 'RECEIVED') {
    throw createError({ statusCode: 400, statusMessage: 'Для отримання заявки використайте дію "Отримати товар"' })
  }

  const hasItems = Array.isArray(body.items)
  const items = hasItems ? normalizePurchaseRequestItems(body.items) : []
  const nextObjectId = typeof body.objectId === 'string' && body.objectId ? body.objectId : undefined
  const hasContractor = Object.prototype.hasOwnProperty.call(body, 'contractorId')
  const nextContractorId = typeof body.contractorId === 'string' && body.contractorId ? body.contractorId : null

  if (nextObjectId) {
    const object = await prisma.constructionObject.findUnique({ where: { id: nextObjectId } })
    if (!object) throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })
  }
  if (hasContractor && nextContractorId) {
    const contractor = await prisma.contractor.findUnique({ where: { id: nextContractorId } })
    if (!contractor) throw createError({ statusCode: 404, statusMessage: 'Контрагента не знайдено' })
  }

  const purchaseRequest = await prisma.$transaction(async (tx) => {
    if (hasItems) {
      await tx.purchaseRequestItem.deleteMany({ where: { purchaseRequestId: id } })
    }

    return tx.purchaseRequest.update({
      where: { id },
      data: {
        ...(nextObjectId ? { objectId: nextObjectId } : {}),
        ...(hasContractor ? { contractorId: nextContractorId } : {}),
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(typeof body.notes === 'string' ? { notes: body.notes.trim() || null } : {}),
        ...(hasItems
          ? {
              items: {
                create: items.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  estimatedPricePerUnit: item.estimatedPricePerUnit ?? 0,
                  note: item.note,
                })),
              },
            }
          : {}),
      },
      include: {
        object: true,
        contractor: true,
        createdBy: { select: { id: true, name: true } },
        invoice: true,
        items: { include: { product: true } },
      },
    })
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'UPDATE',
    entityType: 'PurchaseRequest',
    entityId: id,
    changes: {
      objectId: nextObjectId,
      contractorId: hasContractor ? nextContractorId : undefined,
      status: nextStatus,
      itemCount: hasItems ? items.length : existing.items.length,
    },
  })

  return { purchaseRequest }
})
