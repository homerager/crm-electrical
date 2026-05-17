import { isElevatedRole } from '../../utils/authz'
import { getScheduleHours } from '../../utils/scheduleHours'

const VALID_TYPES = ['WORK', 'DAY_OFF', 'VACATION', 'SICK_LEAVE', 'BIRTHDAY']
const VALID_SHIFTS = ['FULL_DAY', 'MORNING', 'AFTERNOON']

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const existing = await prisma.schedule.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Запис розкладу не знайдено' })

  const { userId, objectId, date, type, shift, description, hours } = body

  if (type !== undefined && !VALID_TYPES.includes(type)) {
    throw createError({ statusCode: 400, statusMessage: 'Невірний тип розкладу' })
  }
  if (shift !== undefined && !VALID_SHIFTS.includes(shift)) {
    throw createError({ statusCode: 400, statusMessage: 'Невірна зміна' })
  }
  if (hours !== undefined && hours !== null && (isNaN(Number(hours)) || Number(hours) < 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Кількість годин має бути >= 0' })
  }

  const newUserId = userId ?? existing.userId
  const newDate = date ? (() => { const d = new Date(date); d.setUTCHours(0, 0, 0, 0); return d })() : existing.date
  const newShift = shift ?? existing.shift
  const newType = type ?? existing.type
  const newHours = hours !== undefined ? (hours != null ? Number(hours) : null) : existing.hours
  const newObjectId = objectId !== undefined ? (objectId || null) : existing.objectId

  // objectId is optional for all types including WORK

  const conflictWhere: any = {
    userId: newUserId,
    date: newDate,
    id: { not: id },
  }
  if (newShift === 'FULL_DAY') {
    // conflicts with anything
  } else {
    conflictWhere.OR = [
      { shift: 'FULL_DAY' },
      { shift: newShift },
    ]
  }

  const conflict = await prisma.schedule.findFirst({ where: conflictWhere })
  if (conflict) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Конфлікт розкладу: працівник вже має запис на цю дату/зміну',
    })
  }

  const effectiveHours = getScheduleHours(newShift, newHours)

  if (newType === 'WORK') {
    const dayEnd = new Date(newDate as Date)
    dayEnd.setUTCHours(23, 59, 59, 999)
    const dayStart = new Date(newDate as Date)
    dayStart.setUTCHours(0, 0, 0, 0)

    const manualTimeLog = await prisma.timeLog.findFirst({
      where: {
        userId: newUserId,
        date: { gte: dayStart, lte: dayEnd },
        schedule: { is: null },
      },
    })
    if (manualTimeLog) {
      throw createError({
        statusCode: 409,
        statusMessage: 'На цю дату для цього користувача вже є ручний запис часу. Видаліть або відредагуйте його в обліку часу.',
      })
    }
  }

  let timeLogId = existing.timeLogId

  if (newType === 'WORK') {
    if (timeLogId) {
      await prisma.timeLog.update({
        where: { id: timeLogId },
        data: {
          userId: newUserId,
          objectId: newObjectId,
          hours: effectiveHours,
          date: newDate,
          description: `Розклад: ${(description !== undefined ? description?.trim() : existing.description) || 'робочий день'}`,
        },
      })
    } else {
      const timeLog = await prisma.timeLog.create({
        data: {
          userId: newUserId,
          objectId: newObjectId,
          hours: effectiveHours,
          date: newDate,
          description: `Розклад: ${(description !== undefined ? description?.trim() : existing.description) || 'робочий день'}`,
          createdById: auth.userId,
        },
      })
      timeLogId = timeLog.id
    }
  } else if (timeLogId) {
    await prisma.timeLog.delete({ where: { id: timeLogId } }).catch(() => {})
    timeLogId = null
  }

  const updated = await prisma.schedule.update({
    where: { id },
    data: {
      ...(userId !== undefined && { userId }),
      ...(date !== undefined && { date: newDate }),
      ...(type !== undefined && { type }),
      ...(shift !== undefined && { shift }),
      ...(objectId !== undefined && { objectId: newType === 'WORK' ? (objectId || null) : null }),
      ...(hours !== undefined && { hours: hours != null ? Number(hours) : null }),
      ...(description !== undefined && { description: description?.trim() || null }),
      timeLogId,
    },
    include: {
      user: { select: { id: true, name: true, jobTitle: { select: { name: true } } } },
      object: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  const auditDiff = computeChanges(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>)
  if (auditDiff) {
    writeAuditLog({
      userId: auth.userId,
      userName: auth.name,
      action: 'UPDATE',
      entityType: 'Schedule',
      entityId: id,
      changes: auditDiff,
    })
  }

  return updated
})
