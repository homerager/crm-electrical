import { isElevatedRole } from '../../utils/authz'
import { getScheduleHours } from '../../utils/scheduleHours'

const VALID_TYPES = ['WORK', 'DAY_OFF', 'VACATION', 'SICK_LEAVE', 'BIRTHDAY']
const VALID_SHIFTS = ['FULL_DAY', 'MORNING', 'AFTERNOON']

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) throw createError({ statusCode: 403 })

  const body = await readBody(event)
  const { entries } = body as {
    entries: Array<{
      userId: string
      objectId?: string | null
      date: string
      type?: string
      shift?: string
      hours?: number | null
      description?: string
    }>
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Масив записів обов\'язковий' })
  }
  if (entries.length > 100) {
    throw createError({ statusCode: 400, statusMessage: 'Максимум 100 записів за раз' })
  }

  const created: string[] = []
  const skipped: string[] = []

  for (const entry of entries) {
    const { userId, objectId, date, description } = entry
    const type = entry.type || 'WORK'
    const shift = entry.shift || 'FULL_DAY'
    const hours = entry.hours != null ? Number(entry.hours) : null

    if (!userId || !date) { skipped.push(`${userId}@${date}: дані неповні`); continue }
    if (!VALID_TYPES.includes(type)) { skipped.push(`${userId}@${date}: невірний тип`); continue }
    if (!VALID_SHIFTS.includes(shift)) { skipped.push(`${userId}@${date}: невірна зміна`); continue }

    const dateObj = new Date(date)
    dateObj.setUTCHours(0, 0, 0, 0)

    const conflictWhere: any = { userId, date: dateObj }
    if (shift === 'FULL_DAY') {
      // conflicts with anything
    } else {
      conflictWhere.OR = [{ shift: 'FULL_DAY' }, { shift }]
    }

    const existing = await prisma.schedule.findFirst({ where: conflictWhere })
    if (existing) {
      skipped.push(`${userId}@${date}: конфлікт`)
      continue
    }

    const effectiveHours = getScheduleHours(shift, hours)

    if (type === 'WORK') {
      const dayEnd = new Date(dateObj)
      dayEnd.setUTCHours(23, 59, 59, 999)

      const manualTimeLog = await prisma.timeLog.findFirst({
        where: {
          userId,
          date: { gte: dateObj, lte: dayEnd },
          schedule: { is: null },
        },
      })
      if (manualTimeLog) {
        skipped.push(`${userId}@${date}: вже є ручний запис часу`)
        continue
      }
    }

    let timeLogId: string | null = null
    if (type === 'WORK') {
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

    const s = await prisma.schedule.create({
      data: {
        userId,
        objectId: type === 'WORK' ? (objectId || null) : null,
        date: dateObj,
        type: type as any,
        shift: shift as any,
        hours,
        timeLogId,
        description: description?.trim() || null,
        createdById: auth.userId,
      },
    })
    created.push(s.id)
  }

  return { created: created.length, skipped }
})
