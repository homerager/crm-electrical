import { isElevatedRole } from '../../utils/authz'
import { resolveManualTimeLogTaskAndObject } from '../../utils/manual-time-log-refs'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Недостатньо прав' })
  }

  const body = await readBody(event)
  const { userId, hours, description, date, taskId, objectId } = body as {
    userId?: string
    hours?: number
    description?: string | null
    date?: string | null
    taskId?: string | null
    objectId?: string | null
  }

  if (!userId?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Оберіть користувача' })
  }
  if (!hours || Number(hours) <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Кількість годин має бути більше 0' })
  }

  const targetUser = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
  })
  if (!targetUser) {
    throw createError({ statusCode: 404, statusMessage: 'Користувача не знайдено' })
  }

  const { taskId: resolvedTaskId, objectId: resolvedObjectId } = await resolveManualTimeLogTaskAndObject({
    taskId,
    objectId,
  })

  const log = await prisma.timeLog.create({
    data: {
      taskId: resolvedTaskId,
      objectId: resolvedObjectId,
      userId,
      createdById: auth.userId,
      hours: Number(hours),
      description: description?.trim() || null,
      date: date ? new Date(date) : new Date(),
    },
    include: {
      user: { select: { id: true, name: true } },
      task: {
        select: {
          id: true,
          title: true,
          status: true,
          objectId: true,
          object: { select: { id: true, name: true } },
        },
      },
      object: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  return log
})
