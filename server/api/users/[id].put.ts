import type { Role } from '@prisma/client'
import { requirePermission } from '../../utils/authz'
import { sanitizeOverrides } from '../../../shared/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'users.manage')
  const auth = event.context.auth

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { role, isActive, name, phone, jobTitleId, hourlyRate, emailNotifications, lowStockNotifications, permissionOverrides } = body

  const resolvedOverrides =
    permissionOverrides !== undefined ? sanitizeOverrides(permissionOverrides) : undefined

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

  const before = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true, phone: true, jobTitleId: true, hourlyRate: true },
  })

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(role !== undefined && { role: role as Role }),
      ...(isActive !== undefined && { isActive }),
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone: phone?.trim() || null }),
      ...(resolvedJobTitleId !== undefined && { jobTitleId: resolvedJobTitleId }),
      ...(resolvedHourlyRate !== undefined && { hourlyRate: resolvedHourlyRate }),
      ...(typeof emailNotifications === 'boolean' && { emailNotifications }),
      ...(typeof lowStockNotifications === 'boolean' && { lowStockNotifications }),
      ...(resolvedOverrides !== undefined && { permissionOverrides: resolvedOverrides }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissionOverrides: true,
      isActive: true,
      phone: true,
      telegramChatId: true,
      emailNotifications: true,
      lowStockNotifications: true,
      jobTitleId: true,
      jobTitle: { select: { id: true, name: true } },
      hourlyRate: true,
    },
  })

  if (before) {
    const diff = computeChanges(before as unknown as Record<string, unknown>, user as unknown as Record<string, unknown>)
    if (diff) writeAuditLog({ userId: auth!.userId, userName: auth!.name, action: 'UPDATE', entityType: 'User', entityId: id, changes: diff })
  }

  return { user }
})
