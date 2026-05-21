import { prisma } from '../../utils/prisma'
import { sendEmail, buildPasswordResetEmail } from '../../utils/email'
import { generateResetToken, hashResetToken, RESET_TOKEN_TTL_MS } from '../../utils/passwordReset'

/**
 * Запит на відновлення паролю.
 * Завжди повертає { ok: true } — щоб не розкривати, чи існує email у системі.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Вкажіть email' })
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, isActive: true },
  })

  // Лист надсилаємо лише активному користувачу, але відповідь однакова в усіх випадках.
  if (user && user.isActive) {
    const token = generateResetToken()
    const tokenHash = hashResetToken(token)
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)

    // Скасовуємо попередні невикористані токени цього користувача.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    })
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    })

    const config = useRuntimeConfig()
    const appUrl = (config.appUrl || 'http://localhost:3000').replace(/\/$/, '')
    const resetUrl = `${appUrl}/reset-password?token=${token}`
    const expiresInMinutes = Math.round(RESET_TOKEN_TTL_MS / 60000)

    const { subject, html } = buildPasswordResetEmail(user.name, resetUrl, expiresInMinutes)
    await sendEmail(user.email, subject, html)
  }

  return { ok: true }
})
