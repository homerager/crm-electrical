import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  const id = getRouterParam(event, 'id')!
  const isElevated = isElevatedRole(auth?.role)

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      members: {
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { tasks: true } },
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
