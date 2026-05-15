import { buildProposalPdf } from '../../../utils/proposalPdf'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      requisite: true,
    },
  })

  if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Пропозицію не знайдено' })

  const req = proposal.requisite
  const equipmentCards = proposal.items
    .filter((i) => i.highlight)
    .map((i) => ({
      title: i.name,
      highlight: i.highlight!,
      spec1: i.spec ?? undefined,
    }))

  const buf = await buildProposalPdf({
    title: proposal.title,
    subtitle: proposal.subtitle ?? undefined,
    tagline: proposal.tagline ?? undefined,
    date: proposal.date.toISOString(),
    usdRate: proposal.usdRate ? Number(proposal.usdRate) : undefined,
    companyName: req ? (req.companyName ?? req.name) : undefined,
    companyTagline: req?.address ?? undefined,
    companyWebsite: req?.email ?? undefined,
    companyPhone: req?.phone ?? undefined,
    equipmentCards: equipmentCards.length ? equipmentCards : undefined,
    items: proposal.items.map((i) => ({
      name: i.name,
      quantity: Number(i.quantity),
      unit: i.unit,
      pricePerUnit: Number(i.priceExVat) * (1 + Number(i.vatPercent) / 100),
    })),
    worksDescription: proposal.worksDescription ?? undefined,
    worksPercent: proposal.worksPercent ? Number(proposal.worksPercent) : undefined,
    techSpecs: proposal.techSpecs ?? undefined,
  })

  const safeName = proposal.title.replace(/[^а-яА-ЯёЁa-zA-Z0-9_\- ]/g, '').trim().slice(0, 40) || 'КП'
  setResponseHeader(event, 'Content-Type', 'application/pdf')
  setResponseHeader(
    event,
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(`КП_${safeName}.pdf`)}`,
  )
  return buf
})
