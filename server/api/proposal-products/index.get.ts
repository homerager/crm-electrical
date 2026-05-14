export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const search = query.search as string | undefined
  const onlyActive = query.active !== 'false'

  const items = await prisma.proposalProduct.findMany({
    where: {
      ...(onlyActive ? { isActive: true } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { groupName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ groupName: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  })

  return { items }
})
