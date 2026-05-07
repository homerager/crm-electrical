export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) throw createError({ statusCode: 404, statusMessage: 'Клієнта не знайдено' })
  return { client }
})
