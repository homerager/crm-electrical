import bcrypt from 'bcryptjs'
import { prisma } from '../../utils/prisma'
import { sendEmail, buildPasswordChangedEmail } from '../../utils/email'
import { hashResetToken, assertPasswordStrong } from '../../utils/passwordReset'

/**
 * Встановлення нового паролю за токеном з email-посилання.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { token, password } = body ?? {}

  if (typeof token !== 'string' || !token) {
    throw createError({ statusCode: 400, statusMessage: 'Відсутній токен' })
  }
  assertPasswordStrong(password)

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
  })

  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Посилання недійсне або термін його дії минув. Запросіть нове.',
    })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user.id },
      data: { passwordHash },
    }),
    // Позначаємо використаний токен і прибираємо всі інші токени користувача.
    prisma.passwordResetToken.deleteMany({ where: { userId: record.user.id } }),
  ])

  const config = useRuntimeConfig()
  const { subject, html } = buildPasswordChangedEmail(record.user.name, config.appUrl)
  await sendEmail(record.user.email, subject, html)

  return { ok: true }
})
