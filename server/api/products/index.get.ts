

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const search = query.search as string | undefined

  const products = await prisma.product.findMany({
    where: search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }] }
      : undefined,
    include: {
      group: true,
      stock: {
        include: { warehouse: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return { products }
})
