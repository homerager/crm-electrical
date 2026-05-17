import { isElevatedRole } from '../../utils/authz'
import { getScheduleHours } from '../../utils/scheduleHours'

const VALID_TYPES = ['WORK', 'DAY_OFF', 'VACATION', 'SICK_LEAVE']
const VALID_SHIFTS = ['FULL_DAY', 'MORNING', 'AFTERNOON']

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const body = await readBody(event)
  const { userId, objectId, date, type, shift, description, hours } = body

  if (!userId) throw createError({ statusCode: 400, statusMessage: 'Працівник обов\'язковий' })
  if (!date) throw createError({ statusCode: 400, statusMessage: 'Дата обов\'язкова' })
  if (type && !VALID_TYPES.includes(type)) {
    throw createError({ statusCode: 400, statusMessage: 'Невірний тип розкладу' })
  }
  if (shift && !VALID_SHIFTS.includes(shift)) {
    throw createError({ statusCode: 400, statusMessage: 'Невірна зміна' })
  }
  if (hours !== undefined && hours !== null && (isNaN(Number(hours)) || Number(hours) < 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Кількість годин має бути >= 0' })
  }

  const scheduleType = type || 'WORK'
  const scheduleShift = shift || 'FULL_DAY'

  if (scheduleType === 'WORK' && !objectId) {
    throw createError({ statusCode: 400, statusMessage: 'Обʼєкт обов\'язковий для робочого дня' })
  }

  const dateObj = new Date(date)
  dateObj.setUTCHours(0, 0, 0, 0)

  const conflictWhere: any = {
    userId,
    date: dateObj,
  }
  if (scheduleShift === 'FULL_DAY') {
    // FULL_DAY conflicts with any existing shift on that day
  } else {
    conflictWhere.OR = [
      { shift: 'FULL_DAY' },
      { shift: scheduleShift },
    ]
  }

  const existing = await prisma.schedule.findFirst({ where: conflictWhere })
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Конфлікт розкладу: працівник вже має запис на цю дату/зміну',
    })
  }

  const effectiveHours = getScheduleHours(scheduleShift, hours != null ? Number(hours) : null)

  let timeLogId: string | null = null
  if (scheduleType === 'WORK') {
    const timeLog = await prisma.timeLog.create({
      data: {
        userId,
        objectId: objectId || null,
        hours: effectiveHours,
        date: dateObj,
        description: `Розклад: ${description?.trim() || 'робочий день'}`,
        createdById: auth.userId,
      },
    })
    timeLogId = timeLog.id
  }

  const schedule = await prisma.schedule.create({
    data: {
      userId,
      objectId: scheduleType === 'WORK' ? (objectId || null) : null,
      date: dateObj,
      type: scheduleType,
      shift: scheduleShift,
      hours: hours != null ? Number(hours) : null,
      timeLogId,
      description: description?.trim() || null,
      createdById: auth.userId,
    },
    include: {
      user: { select: { id: true, name: true, jobTitle: { select: { name: true } } } },
      object: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'CREATE',
    entityType: 'Schedule',
    entityId: schedule.id,
    changes: { userId, date: dateObj.toISOString(), type: scheduleType, shift: scheduleShift, hours: effectiveHours },
  })

  return schedule
})
