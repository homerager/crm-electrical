import { isElevatedRole } from '../../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  const id = getRouterParam(event, 'id')!

  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, message: 'Тільки адмін або менеджер може архівувати проєкт' })
  }

  const body = await readBody(event).catch(() => ({})) as { archived?: boolean }
  const shouldArchive = body?.archived !== false

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) {
    throw createError({ statusCode: 404, message: 'Проєкт не знайдено' })
  }

  const updated = await prisma.project.update({
    where: { id },
    data: { archivedAt: shouldArchive ? new Date() : null },
    include: {
      createdBy: { select: { id: true, name: true } },
      defaultObject: { select: { id: true, name: true } },
      objects: { select: { id: true, name: true, status: true }, orderBy: { name: 'asc' } },
      members: {
        include: { user: { select: { id: true, name: true } } },
      },
      _count: { select: { tasks: true, objects: true } },
    },
  })

  writeAuditLog({
    userId: auth!.userId,
    userName: auth!.name,
    action: shouldArchive ? 'ARCHIVE' : 'UNARCHIVE',
    entityType: 'Project',
    entityId: id,
    changes: { name: project.name },
  })

  return updated
})
