

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const type = query.type as string | undefined

  const movements = await prisma.movement.findMany({
    where: type ? { type: type as any } : undefined,
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      object: true,
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return { movements }
})
