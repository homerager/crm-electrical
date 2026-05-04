import type { Role } from '@prisma/client'
import { isStrictAdmin } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isStrictAdmin(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { role, isActive, name, phone, jobTitleId, hourlyRate } = body

  let resolvedHourlyRate: number | null | undefined
  if (hourlyRate !== undefined) {
    if (hourlyRate === null || hourlyRate === '') {
      resolvedHourlyRate = null
    } else {
      const n = typeof hourlyRate === 'number' ? hourlyRate : Number(String(hourlyRate).replace(',', '.'))
      if (!Number.isFinite(n) || n < 0) {
        throw createError({ statusCode: 400, statusMessage: 'Некоректна ставка (грн/год)' })
      }
      resolvedHourlyRate = n
    }
  }

  let resolvedJobTitleId: string | null | undefined
  if (jobTitleId !== undefined) {
    if (jobTitleId === null || jobTitleId === '') {
      resolvedJobTitleId = null
    } else {
      const jt = await prisma.jobTitle.findUnique({ where: { id: jobTitleId } })
      if (!jt) {
        throw createError({ statusCode: 400, statusMessage: 'Невідома посада' })
      }
      resolvedJobTitleId = jt.id
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(role !== undefined && { role: role as Role }),
      ...(isActive !== undefined && { isActive }),
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone: phone?.trim() || null }),
      ...(resolvedJobTitleId !== undefined && { jobTitleId: resolvedJobTitleId }),
      ...(resolvedHourlyRate !== undefined && { hourlyRate: resolvedHourlyRate }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      phone: true,
      telegramChatId: true,
      jobTitleId: true,
      jobTitle: { select: { id: true, name: true } },
      hourlyRate: true,
    },
  })

  return { user }
})
