import bcrypt from 'bcryptjs'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/authz'
import { writeAuditLog } from '../../../utils/auditLog'
import { assertPasswordStrong } from '../../../utils/passwordReset'

/**
 * Скидання паролю користувача (потрібен дозвіл users.manage).
 * Новий пароль задається вручну.
 */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'users.manage')
  const auth = event.context.auth

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
