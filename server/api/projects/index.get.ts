import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  const isElevated = isElevatedRole(auth?.role)
  const query = getQuery(event)
  const archivedParam = String(query.archived ?? 'false').toLowerCase()
  const archivedFilter: 'only' | 'all' | 'none' =
    archivedParam === 'only' || archivedParam === 'true'
      ? 'only'
      : archivedParam === 'all'
        ? 'all'
        : 'none'

  const archivedWhere =
    archivedFilter === 'only'
      ? { archivedAt: { not: null } }
      : archivedFilter === 'all'
        ? {}
        : { archivedAt: null }

  const memberWhere = isElevated
    ? {}
    : { members: { some: { userId: auth.userId } } }

  const projects = await prisma.project.findMany({
    where: { ...archivedWhere, ...memberWhere },
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
