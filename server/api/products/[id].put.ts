
export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (auth?.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, description, sku, unit, groupId } = body

  const product = await prisma.product.update({
    where: { id },
    data: { name, description, sku: sku || null, unit, groupId: groupId || null },
    include: { group: true },
  })

  return { product }
})
