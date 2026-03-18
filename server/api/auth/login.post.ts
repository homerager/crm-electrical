import bcrypt from 'bcryptjs'
import { prisma } from '~/server/utils/prisma'
import { signJwt } from '~/server/utils/jwt'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email та пароль обовʼязкові' })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.isActive) {
    throw createError({ statusCode: 401, statusMessage: 'Невірні облікові дані' })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Невірні облікові дані' })
  }

  const token = await signJwt({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  })

  setCookie(event, 'token', token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  }
})
