import { requirePermission } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'electricalInstallationWorks.view')

  const query = getQuery(event)
  const objectId = query.objectId as string | undefined
  const type = query.type as string | undefined

  const where: any = {}
  if (objectId) where.objectId = objectId
  if (type) where.type = type

  const works = await prisma.electricalInstallationWork.findMany({
    where,
    include: {
      object: { select: { id: true, name: true, address: true } },
      createdBy: { select: { id: true, name: true } },
      materials: { select: { quantity: true, pricePerUnit: true } },
      _count: { select: { materials: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Estimated total cost per work = Σ(quantity × pricePerUnit) across its materials.
  const result = works.map((w) => {
    const totalAmount = w.materials.reduce(
      (s, m) => s + Number(m.quantity) * Number(m.pricePerUnit),
      0,
    )
    const { materials, ...rest } = w
    return { ...rest, totalAmount: Math.round(totalAmount * 100) / 100 }
  })

  return { works: result }
})
