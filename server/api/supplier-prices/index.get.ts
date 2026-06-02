export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const contractorId = (query.contractorId as string) || undefined
  const productId = (query.productId as string) || undefined
  const search = (query.search as string)?.trim() || undefined
  const activeOnly = query.activeOnly === 'true' || query.activeOnly === '1'

  const where: any = {}
  if (contractorId) where.contractorId = contractorId
  if (productId) where.productId = productId
  if (activeOnly) where.isActive = true
  if (search) {
    where.product = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ],
    }
  }

  const prices = await prisma.supplierPrice.findMany({
    where,
    include: {
      contractor: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, sku: true, unit: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })

  return { prices }
})
