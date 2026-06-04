import { can } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth!
  const id = getRouterParam(event, 'id')!
  const isElevated = await can(event, 'projects.manage')

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      defaultObject: { select: { id: true, name: true } },
      objects: { select: { id: true, name: true, status: true }, orderBy: { name: 'asc' } },
      members: {
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { tasks: true, objects: true } },
    },
  })

  if (!project) {
    throw createError({ statusCode: 404, message: 'Проєкт не знайдено' })
  }

  if (!isElevated && !project.members.some((m) => m.userId === auth.userId)) {
    throw createError({ statusCode: 403, message: 'Доступ заборонено' })
  }

  return project
})
