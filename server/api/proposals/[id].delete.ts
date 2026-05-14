export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const existing = await prisma.proposal.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Пропозицію не знайдено' })
  await prisma.proposal.delete({ where: { id } })
  return { ok: true }
})
