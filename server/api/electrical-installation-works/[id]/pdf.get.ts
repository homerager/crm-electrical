import { setResponseHeader } from 'h3'
import { requirePermission } from '../../../utils/authz'
import { buildInstallationWorkPdf } from '../../../utils/installationWorkPdf'
import { getProductSupplyHistory } from '../../../utils/productSupplyHistory'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'electricalInstallationWorks.view')

  const id = getRouterParam(event, 'id')!

  const work = await prisma.electricalInstallationWork.findUnique({
    where: { id },
    include: {
      object: { select: { name: true, address: true, client: { select: { name: true } } } },
      createdBy: { select: { name: true } },
      materials: {
        include: { contractor: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!work) throw createError({ statusCode: 404, statusMessage: 'Роботу не знайдено' })

  // Resolve the incoming invoice(s) each catalog lot was supplied by (same supplier + price).
  const productIds = [...new Set(work.materials.map((m) => m.productId).filter(Boolean) as string[])]
  const historyMap = await getProductSupplyHistory(productIds)
  const invoiceLabelFor = (m: (typeof work.materials)[number]): string | null => {
    if (!m.productId) return null
    const all = historyMap.get(m.productId) ?? []
    const price = Number(m.pricePerUnit)
    const matched = all.filter(
      (r) => (r.contractor?.id ?? null) === (m.contractorId ?? null) && Math.abs(r.pricePerUnit - price) < 0.01,
    )
    const list = matched.length > 0 ? matched : all
    const numbers = [...new Set(list.map((r) => r.invoice.number))]
    return numbers.length > 0 ? `Накладні: ${numbers.join(', ')}` : null
  }

  const buffer = await buildInstallationWorkPdf({
    type: work.type,
    name: work.name,
    description: work.description,
    objectName: work.object.name,
    objectAddress: work.object.address,
    clientName: work.object.client?.name ?? null,
    createdByName: work.createdBy.name,
    createdAt: work.createdAt,
    materials: work.materials.map((m) => ({
      name: m.name,
      unit: m.unit,
      quantity: Number(m.quantity),
      pricePerUnit: Number(m.pricePerUnit),
      writtenOff: m.writtenOff,
      contractorName: m.contractor?.name ?? null,
      note: m.note,
      invoiceLabel: invoiceLabelFor(m),
    })),
  })

  const safeName = `${work.type}-${work.name}`.replace(/[^\w\s.-]+/g, '_').trim().substring(0, 60)

  const query = getQuery(event)
  const inline = query.inline === '1' || query.inline === 'true'

  setResponseHeader(event, 'content-type', 'application/pdf')
  setResponseHeader(
    event,
    'content-disposition',
    `${inline ? 'inline' : 'attachment'}; filename="installation-work.pdf"; filename*=UTF-8''${encodeURIComponent(`${safeName}.pdf`)}`,
  )
  setResponseHeader(event, 'cache-control', 'private, no-cache')

  return buffer
})
