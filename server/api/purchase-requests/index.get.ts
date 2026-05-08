import type { PurchaseRequestStatus } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const status = query.status as PurchaseRequestStatus | undefined
  const objectId = query.objectId as string | undefined

  const purchaseRequests = await prisma.purchaseRequest.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(objectId ? { objectId } : {}),
    },
    include: {
      object: { select: { id: true, name: true, budget: true } },
      contractor: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      invoice: { select: { id: true, number: true, date: true } },
      items: { include: { product: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return { purchaseRequests }
})
