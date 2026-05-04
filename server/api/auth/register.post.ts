import bcrypt from 'bcryptjs'
import { prisma } from '../../utils/prisma'
import { isStrictAdmin } from '../../utils/authz'
import type { Role } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth || !isStrictAdmin(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Тільки адміністратор може реєструвати користувачів' })
  }

  const body = await readBody(event)
  const { name, email, password, role, phone, jobTitleId, hourlyRate } = body

  if (!name || !email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Всі поля обовʼязкові' })
  }

  let resolvedJobTitleId: string | null = null
  if (jobTitleId) {
    const jt = await prisma.jobTitle.findUnique({ where: { id: jobTitleId } })
    if (!jt) {
      throw createError({ statusCode: 400, statusMessage: 'Невідома посада' })
    }
    resolvedJobTitleId = jt.id
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Користувач з таким email вже існує' })
  }

  let createHourlyRate: number | null = null
  if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== '') {
    const n = typeof hourlyRate === 'number' ? hourlyRate : Number(String(hourlyRate).replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Некоректна ставка (грн/год)' })
    }
    createHourlyRate = n
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: (role as Role) || 'STOREKEEPER',
      phone: typeof phone === 'string' ? phone.trim() || null : null,
      jobTitleId: resolvedJobTitleId,
      ...(createHourlyRate !== null && { hourlyRate: createHourlyRate }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      jobTitleId: true,
      jobTitle: { select: { id: true, name: true } },
      hourlyRate: true,
    },
  })

  return { user }
})
