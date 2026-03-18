import bcrypt from 'bcryptjs'
import { prisma } from '~/server/utils/prisma'
import type { Role } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth || auth.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Тільки адміністратор може реєструвати користувачів' })
  }

  const body = await readBody(event)
  const { name, email, password, role } = body

  if (!name || !email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Всі поля обовʼязкові' })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Користувач з таким email вже існує' })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: (role as Role) || 'STOREKEEPER',
    },
    select: { id: true, name: true, email: true, role: true },
  })

  return { user }
})
