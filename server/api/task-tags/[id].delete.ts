export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!

  const tag = await prisma.taskTag.findUnique({ where: { id } })
  if (!tag) throw createError({ statusCode: 404, statusMessage: 'Тег не знайдено' })

  await prisma.taskTag.delete({ where: { id } })

  return { success: true }
})
