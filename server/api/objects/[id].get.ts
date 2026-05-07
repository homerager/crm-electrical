
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const object = await prisma.constructionObject.findUnique({ where: { id }, include: { client: true } })
  if (!object) throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })

  return { object }
})
