import { requirePermission } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'electricalPanels.view')

  const query = getQuery(event)
  const objectId = query.objectId as string | undefined

  const where: any = {}
  if (objectId) where.objectId = objectId

  const panels = await prisma.electricalPanel.findMany({
    where,
    include: {
      object: { select: { id: true, name: true, address: true } },
      createdBy: { select: { id: true, name: true } },
      materials: { select: { quantity: true, pricePerUnit: true } },
      _count: { select: { materials: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Estimated total cost per panel = Σ(quantity × pricePerUnit) across its materials.
  const result = panels.map((p) => {
    const totalAmount = p.materials.reduce(
      (s, m) => s + Number(m.quantity) * Number(m.pricePerUnit),
      0,
    )
    const { materials, ...rest } = p
    return { ...rest, totalAmount: Math.round(totalAmount * 100) / 100 }
  })

  return { panels: result }
})
