import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const query = getQuery(event)
  const status = query.status as string | undefined
  const priority = query.priority as string | undefined
  const assignedToId = query.assignedToId as string | undefined
  const objectId = query.objectId as string | undefined
  const projectId = query.projectId as string | undefined

  const isElevated = isElevatedRole(auth.role)

  const where: any = {}
  if (isElevated && objectId) {
    where.objectId = objectId
  }
  else {
    where.parentId = null
    if (objectId) where.objectId = objectId
  }
  if (status) where.status = status
  if (priority) where.priority = priority
  if (assignedToId) where.assignedToId = assignedToId

  if (projectId) {
    if (!isElevated) {
      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: auth.userId } },
      })
      if (!member) throw createError({ statusCode: 403, message: 'Доступ заборонено' })
    }
    where.projectId = projectId
  } else {
    // Without specific project filter: show tasks without project + tasks from user's projects
    if (!isElevated) {
      const userProjectIds = await prisma.projectMember
        .findMany({ where: { userId: auth.userId }, select: { projectId: true } })
        .then((members) => members.map((m) => m.projectId))

      where.OR = [{ projectId: null }, { projectId: { in: userProjectIds } }]
    }
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      createdBy: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      object: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, color: true } },
      _count: { select: { timeLogs: true, comments: true, subTasks: true } },
      timeLogs: { select: { hours: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  return {
    tasks: tasks.map((t) => ({
      ...t,
      totalHours: t.timeLogs.reduce((sum, l) => sum + l.hours, 0),
    })),
  }
})
