import { prisma } from '../../utils/prisma'
import { effectivePermissions } from '../../../shared/permissions'
import type { Role, PermissionOverrides } from '../../../shared/permissions'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissionOverrides: true,
      isActive: true,
      phone: true,
      telegramChatId: true,
      emailNotifications: true,
      lowStockNotifications: true,
      jobTitle: { select: { id: true, name: true } },
    },
  })

  if (!user || !user.isActive) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' })
  }

  const permissions = [
    ...effectivePermissions(user.role as Role, (user.permissionOverrides ?? {}) as PermissionOverrides),
  ]
  const { permissionOverrides, ...rest } = user

  return { user: { ...rest, permissions } }
})
