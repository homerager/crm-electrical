import bcrypt from 'bcryptjs'
import { prisma } from '../../../utils/prisma'
import { isStrictAdmin } from '../../../utils/authz'
import { writeAuditLog } from '../../../utils/auditLog'
import { assertPasswordStrong } from '../../../utils/passwordReset'

/**
 * Скидання паролю користувача адміністратором.
 * Адмін задає новий пароль вручну.
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isStrictAdmin(auth?.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Тільки адміністратор може скидати паролі' })
  }

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { password } = body ?? {}

  assertPasswordStrong(password)

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true },
  })
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Користувача не знайдено' })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash } }),
    // Невикористані токени відновлення стають недійсними.
    prisma.passwordResetToken.deleteMany({ where: { userId: id } }),
  ])

  await writeAuditLog({
    userId: auth!.userId,
    userName: auth!.name,
    action: 'UPDATE',
    entityType: 'User',
    entityId: id,
    changes: { password: { old: '••••••', new: 'скинуто адміністратором' } },
  })

  return { ok: true }
})
