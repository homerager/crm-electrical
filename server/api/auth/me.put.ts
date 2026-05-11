export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  const { emailNotifications } = body

  if (typeof emailNotifications !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'emailNotifications must be a boolean' })
  }

  const user = await prisma.user.update({
    where: { id: auth.userId },
    data: { emailNotifications },
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

  return { user }
})
