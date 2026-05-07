export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ isRead?: boolean }>(event)

  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) throw createError({ statusCode: 404, message: 'Сповіщення не знайдено' })
  if (notification.userId !== auth.userId) throw createError({ statusCode: 403 })

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: body.isRead ?? true },
  })

  return updated
})
