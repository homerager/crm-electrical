import { requirePermission } from '../../utils/authz'
import { resolveManualTimeLogRefs } from '../../utils/manual-time-log-refs'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'schedules.manage')

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { userId, hours, description, date, taskId, objectId, warehouseId } = body as {
    userId?: string
    hours?: number
    description?: string | null
    date?: string | null
    taskId?: string | null
    objectId?: string | null
    warehouseId?: string | null
  }

  const existing = await prisma.timeLog.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Запис не знайдено' })

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

  const isScheduleLinked = await prisma.schedule.findFirst({
    where: { timeLogId: id },
  })
  if (!isScheduleLinked) {
    const logDate = date ? new Date(date) : existing.date
    const dayStart = new Date(logDate)
    dayStart.setUTCHours(0, 0, 0, 0)

    const existingSchedule = await prisma.schedule.findFirst({
      where: { userId, date: dayStart, type: 'WORK' },
    })
    if (existingSchedule) {
      throw createError({
        statusCode: 409,
        statusMessage: 'На цю дату для цього користувача вже є запис у розкладі. Видаліть або відредагуйте запис у розкладі.',
      })
    }
  }

  const { taskId: resolvedTaskId, objectId: resolvedObjectId, warehouseId: resolvedWarehouseId }
    = await resolveManualTimeLogRefs({ taskId, objectId, warehouseId })

  const log = await prisma.timeLog.update({
    where: { id },
    data: {
      taskId: resolvedTaskId,
      objectId: resolvedObjectId,
      warehouseId: resolvedWarehouseId,
      userId,
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
      warehouse: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  return log
})
