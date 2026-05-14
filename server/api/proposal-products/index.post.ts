export default defineEventHandler(async (event) => {
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
  }

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Назва є обовʼязковою' })

  const item = await prisma.proposalProduct.create({
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
    },
  })

  return { item }
})
