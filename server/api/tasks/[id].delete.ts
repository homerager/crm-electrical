export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) throw createError({ statusCode: 404, statusMessage: 'Завдання не знайдено' })

  if (task.createdById !== auth.userId && auth.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Недостатньо прав для видалення' })
  }

  await prisma.task.delete({ where: { id } })

  return { ok: true }
})
