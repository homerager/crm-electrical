import type { Prisma, PurchaseRequestStatus } from '@prisma/client'

const OPEN_STATUSES: PurchaseRequestStatus[] = ['DRAFT', 'APPROVED', 'ORDERED']

export interface PurchaseRequestItemInput {
  productId: string
  quantity: number
  estimatedPricePerUnit?: number
  vatPercent?: number
  note?: string
}

export function parsePositiveQuantity(raw: unknown): number {
  const quantity = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Кількість має бути більшою за 0' })
  }
  return quantity
}

export function normalizePurchaseRequestItems(rawItems: unknown): PurchaseRequestItemInput[] {
  const items = Array.isArray(rawItems) ? rawItems : []
  if (!items.length) {
    throw createError({ statusCode: 400, statusMessage: 'Додайте хоча б одну позицію' })
  }

  return items.map((raw) => {
    const item = raw as Record<string, unknown>
    const productId = typeof item.productId === 'string' ? item.productId : ''
    if (!productId) {
      throw createError({ statusCode: 400, statusMessage: 'Оберіть товар для кожної позиції' })
    }

    const priceRaw = item.estimatedPricePerUnit ?? 0
    const estimatedPricePerUnit = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw)
    if (!Number.isFinite(estimatedPricePerUnit) || estimatedPricePerUnit < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Орієнтовна ціна не може бути відʼємною' })
    }

    const vatRaw = item.vatPercent ?? 0
    const vatPercent = typeof vatRaw === 'number' ? vatRaw : Number(vatRaw)

    return {
      productId,
      quantity: parsePositiveQuantity(item.quantity),
      estimatedPricePerUnit,
      vatPercent: Number.isFinite(vatPercent) && vatPercent >= 0 ? vatPercent : 0,
      note: typeof item.note === 'string' && item.note.trim() ? item.note.trim() : undefined,
    }
  })
}

export async function addWarehouseStock(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  productId: string,
  quantity: number,
) {
  const existing = await tx.warehouseStock.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  })

  if (existing) {
    await tx.warehouseStock.update({
      where: { productId_warehouseId: { productId, warehouseId } },
      data: { quantity: Number(existing.quantity) + quantity },
    })
    return
  }

  await tx.warehouseStock.create({ data: { productId, warehouseId, quantity } })
}

async function latestUnitPrice(productId: string): Promise<number> {
  const line = await prisma.invoiceItem.findFirst({
    where: { productId, invoice: { type: 'INCOMING' } },
    orderBy: { invoice: { date: 'desc' } },
    select: { pricePerUnit: true },
  })
  return line ? Number(line.pricePerUnit) : 0
}

export async function buildObjectPurchaseNeeds(objectId: string) {
  const object = await prisma.constructionObject.findUnique({ where: { id: objectId } })
  if (!object) throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })

  const [issuedRows, objectStockRows, reservationRows, openRequestRows] = await Promise.all([
    prisma.movementItem.groupBy({
      by: ['productId'],
      where: { movement: { objectId, type: 'WAREHOUSE_TO_OBJECT' } },
      _sum: { quantity: true },
    }),
    prisma.objectStock.findMany({ where: { objectId, quantity: { gt: 0 } }, select: { productId: true, quantity: true } }),
    prisma.warehouseObjectReservation.groupBy({
      by: ['productId'],
      where: { objectId },
      _sum: { quantity: true },
    }),
    prisma.purchaseRequestItem.groupBy({
      by: ['productId'],
      where: { purchaseRequest: { objectId, status: { in: OPEN_STATUSES } } },
      _sum: { quantity: true },
    }),
  ])

  const availableByProduct = new Map<string, number>()
  for (const row of objectStockRows) {
    availableByProduct.set(row.productId, (availableByProduct.get(row.productId) ?? 0) + Number(row.quantity))
  }
  for (const row of reservationRows) {
    availableByProduct.set(row.productId, (availableByProduct.get(row.productId) ?? 0) + Number(row._sum.quantity ?? 0))
  }
  for (const row of openRequestRows) {
    availableByProduct.set(row.productId, (availableByProduct.get(row.productId) ?? 0) + Number(row._sum.quantity ?? 0))
  }

  const productIds = issuedRows.map((row) => row.productId)
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
  const productById = new Map(products.map((product) => [product.id, product]))

  const items = []
  for (const row of issuedRows) {
    const issued = Number(row._sum.quantity ?? 0)
    const available = availableByProduct.get(row.productId) ?? 0
    const needed = Math.round(Math.max(0, issued - available) * 1000) / 1000
    if (needed <= 0) continue

    const product = productById.get(row.productId)
    items.push({
      productId: row.productId,
      product,
      quantity: needed,
      estimatedPricePerUnit: await latestUnitPrice(row.productId),
      baselineQuantity: issued,
      availableQuantity: available,
    })
  }

  items.sort((a, b) => (a.product?.name ?? '').localeCompare(b.product?.name ?? ''))

  const budget = object.budget != null ? Number(object.budget) : null
  const estimatedTotal = items.reduce((sum, item) => sum + item.quantity * item.estimatedPricePerUnit, 0)

  return { object, items, budget, estimatedTotal }
}

export async function createIncomingInvoiceForPurchaseRequest(
  tx: Prisma.TransactionClient,
  params: {
    requestId: string
    number: string
    warehouseId: string
    contractorId?: string | null
    date: string | Date
    notes?: string | null
    createdById: string
    prices?: Record<string, number>
  },
) {
  const request = await tx.purchaseRequest.findUnique({
    where: { id: params.requestId },
    include: { items: true, object: true },
  })
  if (!request) throw createError({ statusCode: 404, statusMessage: 'Заявку не знайдено' })
  if (request.status === 'RECEIVED') {
    throw createError({ statusCode: 400, statusMessage: 'Заявку вже отримано' })
  }
  if (!request.items.length) {
    throw createError({ statusCode: 400, statusMessage: 'У заявці немає позицій' })
  }

  const invoice = await tx.invoice.create({
    data: {
      number: params.number,
      type: 'INCOMING',
      contractorId: params.contractorId || request.contractorId || null,
      warehouseId: params.warehouseId,
      createdById: params.createdById,
      date: new Date(params.date),
      notes: params.notes || `Створено з заявки на закупівлю для обʼєкта "${request.object.name}"`,
      items: {
        create: request.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          pricePerUnit: params.prices?.[item.id] ?? Number(item.estimatedPricePerUnit) ?? 0,
          vatPercent: Number(item.vatPercent) ?? 0,
        })),
      },
    },
    include: { items: true },
  })

  for (const item of request.items) {
    await addWarehouseStock(tx, params.warehouseId, item.productId, Number(item.quantity))
  }

  const updatedRequest = await tx.purchaseRequest.update({
    where: { id: request.id },
    data: { status: 'RECEIVED', invoiceId: invoice.id },
    include: {
      object: true,
      contractor: true,
      createdBy: { select: { id: true, name: true } },
      invoice: true,
      items: { include: { product: true } },
    },
  })

  return { invoice, purchaseRequest: updatedRequest }
}
