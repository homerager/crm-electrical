interface ItemInput {
  id?: string
  proposalProductId?: string
  name: string
  quantity: number
  unit: string
  priceExVat: number
  vatPercent?: number
  highlight?: string
  spec?: string
  sortOrder?: number
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const {
    title,
    subtitle,
    tagline,
    date,
    usdRate,
    requisiteId,
    worksDescription,
    techSpecs,
    items = [],
  } = body as {
    title: string
    subtitle?: string
    tagline?: string
    date?: string
    usdRate?: number
    requisiteId?: string
    worksDescription?: string
    techSpecs?: string
    items: ItemInput[]
  }

  if (!title) throw createError({ statusCode: 400, statusMessage: 'Назва є обовʼязковою' })

  const existing = await prisma.proposal.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Пропозицію не знайдено' })

  // Replace all items (delete + recreate)
  const proposal = await prisma.$transaction(async (tx) => {
    await tx.proposalItem.deleteMany({ where: { proposalId: id } })

    return tx.proposal.update({
      where: { id },
      data: {
        title,
        subtitle: subtitle || null,
        tagline: tagline || null,
        date: date ? new Date(date) : existing.date,
        usdRate: usdRate ?? null,
        requisiteId: requisiteId || null,
        worksDescription: worksDescription || null,
        techSpecs: techSpecs || null,
        items: {
          create: items.map((item, idx) => ({
            proposalProductId: item.proposalProductId || null,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            priceExVat: item.priceExVat,
            vatPercent: item.vatPercent ?? 0,
            highlight: item.highlight || null,
            spec: item.spec || null,
            sortOrder: item.sortOrder ?? idx,
          })),
        },
      },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        requisite: true,
      },
    })
  })

  return { proposal }
})
