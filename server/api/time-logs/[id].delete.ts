import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')!

  const log = await prisma.timeLog.findUnique({
    where: { id },
    include: { task: { select: { assignedToId: true } } },
  })
  if (!log) throw createError({ statusCode: 404, statusMessage: 'Запис не знайдено' })

  const isAssigneeOfTask = log.task?.assignedToId === auth.userId
  const isOwnLog = log.userId === auth.userId
  if (!isOwnLog && !isElevatedRole(auth.role) && !isAssigneeOfTask) {
    throw createError({ statusCode: 403, statusMessage: 'Недостатньо прав' })
  }

  await prisma.timeLog.delete({ where: { id } })

  return { ok: true }
})
