interface ItemInput {
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
  const auth = event.context.auth!
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const body = await readBody(event)
  const {
    title,
    subtitle,
    tagline,
    date,
    usdRate,
    requisiteId,
    worksDescription,
    worksPercent,
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
    worksPercent?: number
    techSpecs?: string
    items: ItemInput[]
  }

  if (!title) throw createError({ statusCode: 400, statusMessage: 'Назва є обовʼязковою' })

  const proposal = await prisma.proposal.create({
    data: {
      title,
      subtitle: subtitle || null,
      tagline: tagline || null,
      date: date ? new Date(date) : new Date(),
      usdRate: usdRate ?? null,
      requisiteId: requisiteId || null,
      worksDescription: worksDescription || null,
      worksPercent: worksPercent ?? null,
      techSpecs: techSpecs || null,
      createdById: auth.userId,
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

  return { proposal }
})
