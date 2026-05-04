

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (auth?.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      phone: true,
      telegramChatId: true,
      createdAt: true,
      jobTitleId: true,
      jobTitle: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return { users }
})
