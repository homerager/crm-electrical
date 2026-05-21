export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const existing = await prisma.document.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Документ не знайдено' })
  await prisma.document.delete({ where: { id } })
  return { ok: true }
})
