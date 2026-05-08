export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const purchaseRequest = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      object: { include: { client: true } },
      contractor: true,
      createdBy: { select: { id: true, name: true } },
      invoice: { select: { id: true, number: true, date: true, warehouse: true, contractor: true } },
      items: { include: { product: true } },
    },
  })

  if (!purchaseRequest) throw createError({ statusCode: 404, statusMessage: 'Заявку не знайдено' })

  return { purchaseRequest }
})
