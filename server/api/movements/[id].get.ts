
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const movement = await prisma.movement.findUnique({
    where: { id },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      object: true,
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: true } },
    },
  })

  if (!movement) throw createError({ statusCode: 404, statusMessage: 'Переміщення не знайдено' })

  return { movement }
})
