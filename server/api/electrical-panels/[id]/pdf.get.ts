import { setResponseHeader } from 'h3'
import { requirePermission } from '../../../utils/authz'
import { buildElectricalPanelPdf } from '../../../utils/electricalPanelPdf'
import { getProductSupplyHistory } from '../../../utils/productSupplyHistory'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'electricalPanels.view')

  const id = getRouterParam(event, 'id')!

  const panel = await prisma.electricalPanel.findUnique({
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

  if (!panel) throw createError({ statusCode: 404, statusMessage: 'Електрощит не знайдено' })

  // Resolve the incoming invoice(s) each catalog lot was supplied by (same supplier + price).
  const productIds = [...new Set(panel.materials.map((m) => m.productId).filter(Boolean) as string[])]
  const historyMap = await getProductSupplyHistory(productIds)
  const invoiceLabelFor = (m: (typeof panel.materials)[number]): string | null => {
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

  const buffer = await buildElectricalPanelPdf({
    name: panel.name,
    description: panel.description,
    objectName: panel.object.name,
    objectAddress: panel.object.address,
    clientName: panel.object.client?.name ?? null,
    createdByName: panel.createdBy.name,
    createdAt: panel.createdAt,
    materials: panel.materials.map((m) => ({
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

  const safeName = panel.name.replace(/[^\w\s.-]+/g, '_').trim().substring(0, 60)

  const query = getQuery(event)
  const inline = query.inline === '1' || query.inline === 'true'

  setResponseHeader(event, 'content-type', 'application/pdf')
  setResponseHeader(
    event,
    'content-disposition',
    `${inline ? 'inline' : 'attachment'}; filename="electrical-panel.pdf"; filename*=UTF-8''${encodeURIComponent(`Електрощит-${safeName}.pdf`)}`,
  )
  setResponseHeader(event, 'cache-control', 'private, no-cache')

  return buffer
})
