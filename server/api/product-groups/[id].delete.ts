
export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (auth?.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!

  const group = await prisma.productGroup.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  })
  if (!group) throw createError({ statusCode: 404, statusMessage: 'Групу не знайдено' })

  if (group._count.products > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Неможливо видалити: у групі є ${group._count.products} товар(ів). Спочатку відʼєднайте товари від групи.`,
    })
  }

  await prisma.productGroup.delete({ where: { id } })

  return { ok: true }
})
