import { requirePermission } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'projects.create')
  const auth = event.context.auth!

  const body = await readBody(event)
  const { name, description, color, memberIds, defaultObjectId, objectIds } = body

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
      objects: { select: { id: true, name: true, status: true }, orderBy: { name: 'asc' } },
      members: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      _count: { select: { tasks: true, objects: true } },
    },
  })

  if (Array.isArray(objectIds) && objectIds.length > 0) {
    await prisma.constructionObject.updateMany({
      where: { id: { in: objectIds } },
      data: { projectId: project.id },
    })
  }

  writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'CREATE', entityType: 'Project', entityId: project.id, changes: { name: project.name, color: project.color } })

  return project
})
