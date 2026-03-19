import type { Role } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (auth?.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { role, isActive, name } = body

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(role !== undefined && { role: role as Role }),
      ...(isActive !== undefined && { isActive }),
      ...(name !== undefined && { name }),
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })

  return { user }
})
