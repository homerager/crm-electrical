export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      items: {
        include: { proposalProduct: true },
        orderBy: { sortOrder: 'asc' },
      },
      requisite: true,
      createdBy: { select: { id: true, name: true } },
    },
  })

  if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Пропозицію не знайдено' })

  return { proposal }
})
