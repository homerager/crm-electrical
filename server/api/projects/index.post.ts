export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  const body = await readBody(event)
  const { name, description, color, memberIds } = body

  if (!name?.trim()) {
    throw createError({ statusCode: 400, message: 'Назва проєкту обовʼязкова' })
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: description || null,
      color: color || '#1976D2',
      createdById: auth.userId,
      members: {
        create: [
          { userId: auth.userId, role: 'OWNER' },
          ...((memberIds as string[]) || [])
            .filter((id) => id !== auth.userId)
            .map((userId: string) => ({ userId, role: 'MEMBER' as const })),
        ],
      },
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      members: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      _count: { select: { tasks: true } },
    },
  })

  return project
})
