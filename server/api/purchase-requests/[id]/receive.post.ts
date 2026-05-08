import { createIncomingInvoiceForPurchaseRequest } from '../../../utils/purchaseRequests'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth!
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { number, warehouseId, contractorId, date, notes } = body

  if (!number || !warehouseId || !date) {
    throw createError({ statusCode: 400, statusMessage: 'Вкажіть номер накладної, склад і дату' })
  }

  const rawPrices = body.prices && typeof body.prices === 'object' ? body.prices as Record<string, unknown> : {}
  const prices: Record<string, number> = {}
  for (const [itemId, raw] of Object.entries(rawPrices)) {
    const price = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(price) || price < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Ціна в накладній не може бути відʼємною' })
    }
    prices[itemId] = price
  }

  const result = await prisma.$transaction((tx) =>
    createIncomingInvoiceForPurchaseRequest(tx, {
      requestId: id,
      number,
      warehouseId,
      contractorId: contractorId || null,
      date,
      notes,
      createdById: auth.userId,
      prices,
    }),
  )

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'RECEIVE',
    entityType: 'PurchaseRequest',
    entityId: id,
    changes: { invoiceId: result.invoice.id, invoiceNumber: result.invoice.number, warehouseId },
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'CREATE',
    entityType: 'Invoice',
    entityId: result.invoice.id,
    changes: { number, type: 'INCOMING', warehouseId, contractorId, source: 'PurchaseRequest', purchaseRequestId: id },
  })

  return result
})
