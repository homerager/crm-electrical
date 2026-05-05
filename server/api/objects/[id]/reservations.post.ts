import { adjustReservationDelta } from '../../../utils/warehouseReservations'

export default defineEventHandler(async (event) => {
  const objectId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { warehouseId, productId, quantityDelta } = body

  if (!warehouseId || !productId || quantityDelta === undefined || quantityDelta === null) {
    throw createError({ statusCode: 400, statusMessage: 'Вкажіть склад, товар і зміну кількості' })
  }

  const delta = typeof quantityDelta === 'number' ? quantityDelta : Number(quantityDelta)
  if (!Number.isFinite(delta) || delta === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Зміна кількості має бути ненульовим числом' })
  }

  const object = await prisma.constructionObject.findUnique({ where: { id: objectId } })
  if (!object) throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })

  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } })
  if (!warehouse) throw createError({ statusCode: 400, statusMessage: 'Склад не знайдено' })

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) throw createError({ statusCode: 400, statusMessage: 'Товар не знайдено' })

  await prisma.$transaction(async (tx) => {
    await adjustReservationDelta(tx, objectId, warehouseId, productId, delta)
  })

  return { ok: true }
})
