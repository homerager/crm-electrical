
export default defineEventHandler(async () => {
  const groups = await prisma.productGroup.findMany({
    include: {
      _count: { select: { products: true } },
    },
    orderBy: { name: 'asc' },
  })

  return { groups }
})
