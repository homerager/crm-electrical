import { requirePermission } from '../../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'inventory.manage')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID обовʼязковий' })

  const session = await prisma.materialInventorySession.findUnique({ where: { id } })
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Сесію інвентаризації не знайдено' })
  }
  if (session.status === 'COMPLETED') {
    throw createError({ statusCode: 400, statusMessage: 'Сесія вже завершена' })
  }

  const body = await readBody(event)
  const { productId, barcode } = body

  if (!productId && !barcode) {
    throw createError({ statusCode: 400, statusMessage: 'Вкажіть productId або barcode' })
  }

  let product
  if (productId) {
    product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, sku: true, barcode: true, unit: true },
    })
  } else {
    product = await prisma.product.findUnique({
      where: { barcode: String(barcode).trim() },
      select: { id: true, name: true, sku: true, barcode: true, unit: true },
    })
  }

  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Товар не знайдено' })
  }

  // `countedQty` (абсолютне значення) — ручне введення; інакше +1 за кожне сканування камерою
  const hasAbsolute = body?.countedQty !== undefined && body?.countedQty !== null && body?.countedQty !== ''
  const absoluteQty = hasAbsolute ? Number(body.countedQty) : null
  if (hasAbsolute && (!Number.isFinite(absoluteQty as number) || (absoluteQty as number) < 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Кількість має бути числом ≥ 0' })
  }

  const existingItem = await prisma.materialInventoryItem.findUnique({
    where: { sessionId_productId: { sessionId: id, productId: product.id } },
  })

  let item
  if (existingItem) {
    const nextCounted = hasAbsolute
      ? (absoluteQty as number)
      : Number(existingItem.countedQty ?? 0) + 1
    item = await prisma.materialInventoryItem.update({
      where: { id: existingItem.id },
      data: { countedQty: nextCounted, scannedAt: new Date() },
    })
  } else {
    item = await prisma.materialInventoryItem.create({
      data: {
        sessionId: id,
        productId: product.id,
        expectedQty: 0,
        countedQty: hasAbsolute ? (absoluteQty as number) : 1,
        scannedAt: new Date(),
      },
    })
  }

  const expected = Number(item.expectedQty)
  const counted = Number(item.countedQty ?? 0)
  let scanResult: 'matched' | 'shortage' | 'surplus' | 'unexpected'
  if (expected === 0 && !existingItem) {
    scanResult = 'unexpected'
  } else if (counted === expected) {
    scanResult = 'matched'
  } else if (counted < expected) {
    scanResult = 'shortage'
  } else {
    scanResult = 'surplus'
  }

  return { item, product, scanResult }
})
