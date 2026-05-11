import { prisma } from '../../utils/prisma'

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
      isActive: true,
      emailNotifications: true,
      jobTitle: { select: { id: true, name: true } },
    },
  })

  if (!user || !user.isActive) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' })
  }

  return { user }
})
