
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const contractor = await prisma.contractor.findUnique({ where: { id } })
  if (!contractor) throw createError({ statusCode: 404, statusMessage: 'Контрагента не знайдено' })
  return { contractor }
})
