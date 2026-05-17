import bcrypt from 'bcryptjs'
import { prisma } from '../../utils/prisma'
import { signJwt } from '../../utils/jwt'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email та пароль обовʼязкові' })
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      passwordHash: true,
      jobTitle: { select: { id: true, name: true } },
    },
  })
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
    secure: !import.meta.dev,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      jobTitle: user.jobTitle,
    },
  }
})
