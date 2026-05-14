export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const {
    name,
    description,
    sku,
    unit,
    groupName,
    priceExVat,
    vatPercent,
    notes,
    sortOrder,
    isActive,
  } = body as {
    name: string
    description?: string
    sku?: string
    unit?: string
    groupName?: string
    priceExVat: number
    vatPercent?: number
    notes?: string
    sortOrder?: number
    isActive?: boolean
  }

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Назва є обовʼязковою' })

  const item = await prisma.proposalProduct.update({
    where: { id },
    data: {
      name,
      description: description || null,
      sku: sku || null,
      unit: unit || 'шт',
      groupName: groupName || null,
      priceExVat,
      vatPercent: vatPercent ?? 20,
      notes: notes || null,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
    },
  })

  return { item }
})
