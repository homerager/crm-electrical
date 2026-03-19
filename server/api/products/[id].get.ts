
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      stock: { include: { warehouse: true } },
    },
  })

  if (!product) throw createError({ statusCode: 404, statusMessage: 'Товар не знайдено' })

  return { product }
})
