import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, message: 'Недостатньо прав для створення проєкту' })
  }

  const body = await readBody(event)
  const { name, description, color, memberIds, defaultObjectId } = body

  if (!name?.trim()) {
    throw createError({ statusCode: 400, message: 'Назва проєкту обовʼязкова' })
  }

  let resolvedDefaultObjectId: string | null = null
  if (defaultObjectId) {
    const obj = await prisma.constructionObject.findUnique({ where: { id: defaultObjectId } })
    if (!obj) throw createError({ statusCode: 400, message: 'Обʼєкт не знайдено' })
    resolvedDefaultObjectId = defaultObjectId
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: description || null,
      color: color || '#1976D2',
      defaultObjectId: resolvedDefaultObjectId,
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
      defaultObject: { select: { id: true, name: true } },
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
