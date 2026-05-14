export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const auth = event.context.auth!

  const source = await prisma.proposal.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!source) throw createError({ statusCode: 404, statusMessage: 'Пропозицію не знайдено' })

  const copy = await prisma.proposal.create({
    data: {
      title: `${source.title} (копія)`,
      subtitle: source.subtitle,
      tagline: source.tagline,
      date: new Date(),
      usdRate: source.usdRate,
      requisiteId: source.requisiteId,
      worksDescription: source.worksDescription,
      techSpecs: source.techSpecs,
      createdById: auth.userId,
      items: {
        create: source.items.map((i) => ({
          proposalProductId: i.proposalProductId,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          priceExVat: i.priceExVat,
          vatPercent: i.vatPercent,
          highlight: i.highlight,
          spec: i.spec,
          sortOrder: i.sortOrder,
        })),
      },
    },
  })

  return { proposal: copy }
})
