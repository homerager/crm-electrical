import { prisma } from '../../utils/prisma'
import { hashResetToken } from '../../utils/passwordReset'

/**
 * Перевірка валідності токена відновлення паролю (для UX сторінки скидання).
 * Повертає { valid, email? }.
 */
export default defineEventHandler(async (event) => {
  const { token } = getQuery(event)

  if (typeof token !== 'string' || !token) {
    return { valid: false }
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: {
      usedAt: true,
      expiresAt: true,
      user: { select: { email: true, isActive: true } },
    },
  })

  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive) {
    return { valid: false }
  }

  return { valid: true, email: record.user.email }
})
