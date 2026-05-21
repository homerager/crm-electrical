import bcrypt from 'bcryptjs'
import { prisma } from '../../utils/prisma'
import { sendEmail, buildPasswordChangedEmail } from '../../utils/email'
import { assertPasswordStrong } from '../../utils/passwordReset'

/**
 * Зміна власного паролю авторизованим користувачем.
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const body = await readBody(event)
  const { currentPassword, newPassword } = body ?? {}

  if (typeof currentPassword !== 'string' || !currentPassword) {
    throw createError({ statusCode: 400, statusMessage: 'Вкажіть поточний пароль' })
  }
  assertPasswordStrong(newPassword)

  if (currentPassword === newPassword) {
    throw createError({ statusCode: 400, statusMessage: 'Новий пароль має відрізнятися від поточного' })
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, name: true, email: true, isActive: true, passwordHash: true },
  })
  if (!user || !user.isActive) {
    throw createError({ statusCode: 401, statusMessage: 'Користувача не знайдено' })
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) {
    throw createError({ statusCode: 400, statusMessage: 'Поточний пароль вказано невірно' })
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  // Будь-які активні токени відновлення стають недійсними.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })

  const config = useRuntimeConfig()
  const { subject, html } = buildPasswordChangedEmail(user.name, config.appUrl)
  await sendEmail(user.email, subject, html)

  return { ok: true }
})
