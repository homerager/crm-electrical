

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const type = query.type as string | undefined

  const invoices = await prisma.invoice.findMany({
    where: type ? { type: type as any } : undefined,
    include: {
      contractor: true,
      warehouse: true,
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return { invoices }
})
