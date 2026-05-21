export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const type = query.type as string | undefined
  const search = query.search as string | undefined
  const contractorId = query.contractorId as string | undefined
  const warehouseId = query.warehouseId as string | undefined
  const objectId = query.objectId as string | undefined

  const where: any = {}
  if (type) where.type = type
  if (search) where.number = { contains: search, mode: 'insensitive' }
  if (contractorId) where.contractorId = contractorId
  if (warehouseId) where.warehouseId = warehouseId
  if (objectId) where.objectId = objectId

  const invoices = await prisma.invoice.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    include: {
      contractor: true,
      warehouse: true,
      object: true,
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return { invoices }
})
