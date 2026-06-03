import { can } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  // Чутливі поля (ставка, індивідуальні права) — лише за наявності доступу до модуля користувачів.
  const canViewUsers = await can(event, 'users.view')

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      phone: true,
      telegramChatId: true,
      emailNotifications: true,
      lowStockNotifications: true,
      createdAt: true,
      jobTitleId: true,
      jobTitle: { select: { id: true, name: true } },
      permissionOverrides: canViewUsers,
      hourlyRate: canViewUsers,
    },
    orderBy: { createdAt: 'desc' },
  })

  return { users }
})
