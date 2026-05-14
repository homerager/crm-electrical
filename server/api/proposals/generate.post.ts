import { buildProposalPdf } from '../../utils/proposalPdf'
import type { ProposalItem, ProposalEquipmentCard } from '../../utils/proposalPdf'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const {
    title,
    subtitle,
    tagline,
    date,
    usdRate,
    requisiteId,
    equipmentCards,
    items,
    worksDescription,
    techSpecs,
  } = body as {
    title: string
    subtitle?: string
    tagline?: string
    date?: string
    usdRate?: number
    requisiteId?: string
    equipmentCards?: ProposalEquipmentCard[]
    items: ProposalItem[]
    worksDescription?: string
    techSpecs?: string
  }

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Назва проекту є обовʼязковою' })
  }
  if (!items?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Додайте хоча б одну позицію' })
  }

  let companyName: string | undefined
  let companyTagline: string | undefined
  let companyWebsite: string | undefined
  let companyPhone: string | undefined

  if (requisiteId) {
    const req = await prisma.requisite.findUnique({ where: { id: requisiteId } })
    if (req) {
      companyName = req.companyName ?? req.name
      companyWebsite = req.email ?? undefined
      companyPhone = req.phone ?? undefined
      companyTagline = req.address ?? undefined
    }
  }

  const buf = await buildProposalPdf({
    title,
    subtitle,
    tagline,
    date,
    usdRate,
    companyName,
    companyTagline,
    companyWebsite,
    companyPhone,
    equipmentCards: equipmentCards ?? [],
    items,
    worksDescription,
    techSpecs,
  })

  const safeName = title.replace(/[^а-яА-ЯёЁa-zA-Z0-9_\- ]/g, '').trim().slice(0, 40) || 'КП'
  setResponseHeader(event, 'Content-Type', 'application/pdf')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`КП_${safeName}.pdf`)}`)
  return buf
})
