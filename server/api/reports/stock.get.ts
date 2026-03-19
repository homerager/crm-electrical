

export default defineEventHandler(async () => {
  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    include: {
      stock: {
        include: { product: true },
        where: { quantity: { gt: 0 } },
        orderBy: { product: { name: 'asc' } },
      },
    },
    orderBy: { name: 'asc' },
  })

  return { warehouses }
})
