import { isStrictAdmin } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const isAdmin = isStrictAdmin(auth.role)

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissionOverrides: isAdmin,
      isActive: true,
      phone: true,
      telegramChatId: true,
      emailNotifications: true,
      lowStockNotifications: true,
      createdAt: true,
      jobTitleId: true,
      jobTitle: { select: { id: true, name: true } },
      hourlyRate: isAdmin,
    },
    orderBy: { createdAt: 'desc' },
  })

  return { users }
})
