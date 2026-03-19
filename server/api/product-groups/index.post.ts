
export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (auth?.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const { name, description } = body

  if (!name?.trim()) throw createError({ statusCode: 400, statusMessage: 'Назва обовʼязкова' })

  const existing = await prisma.productGroup.findUnique({ where: { name: name.trim() } })
  if (existing) throw createError({ statusCode: 409, statusMessage: 'Група з такою назвою вже існує' })

  const group = await prisma.productGroup.create({
    data: { name: name.trim(), description: description?.trim() || null },
    include: { _count: { select: { products: true } } },
  })

  return { group }
})
