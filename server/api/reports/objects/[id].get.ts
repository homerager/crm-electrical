import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const object = await prisma.constructionObject.findUnique({ where: { id } })
  if (!object) throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })

  const movements = await prisma.movement.findMany({
    where: { objectId: id, type: 'WAREHOUSE_TO_OBJECT' },
    include: {
      items: { include: { product: true } },
      fromWarehouse: true,
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  })

  const productMap = new Map<string, { product: any; totalQuantity: number; unit: string }>()

  for (const movement of movements) {
    for (const item of movement.items) {
      const key = item.productId
      if (productMap.has(key)) {
        productMap.get(key)!.totalQuantity += Number(item.quantity)
      } else {
        productMap.set(key, {
          product: item.product,
          totalQuantity: Number(item.quantity),
          unit: item.product.unit,
        })
      }
    }
  }

  const summary = Array.from(productMap.values()).sort((a, b) =>
    a.product.name.localeCompare(b.product.name),
  )

  return { object, movements, summary }
})
