
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: {
      stock: {
        include: { product: true },
        where: { quantity: { gt: 0 } },
        orderBy: { product: { name: 'asc' } },
      },
    },
  })

  if (!warehouse) throw createError({ statusCode: 404, statusMessage: 'Склад не знайдено' })

  return { warehouse }
})
