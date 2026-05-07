export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const count = await prisma.notification.count({
    where: { userId: auth.userId, isRead: false },
  })

  return { count }
})
