export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  const { emailNotifications, lowStockNotifications } = body

  if (emailNotifications === undefined && lowStockNotifications === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }
  if (emailNotifications !== undefined && typeof emailNotifications !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'emailNotifications must be a boolean' })
  }
  if (lowStockNotifications !== undefined && typeof lowStockNotifications !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'lowStockNotifications must be a boolean' })
  }

  const user = await prisma.user.update({
    where: { id: auth.userId },
    data: {
      ...(typeof emailNotifications === 'boolean' && { emailNotifications }),
      ...(typeof lowStockNotifications === 'boolean' && { lowStockNotifications }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      emailNotifications: true,
      lowStockNotifications: true,
      jobTitle: { select: { id: true, name: true } },
    },
  })

  return { user }
})
