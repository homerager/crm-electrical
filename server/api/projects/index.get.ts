import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  const isElevated = isElevatedRole(auth?.role)

  const projects = await prisma.project.findMany({
    where: isElevated
      ? undefined
      : {
          members: {
            some: { userId: auth.userId },
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
      objects: { select: { id: true, name: true, status: true }, orderBy: { name: 'asc' } },
      _count: {
        select: { tasks: true, objects: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return projects
})
