import type { H3Event } from 'h3'
import { prisma } from './prisma'
import {
  type Role,
  type PermissionOverrides,
  effectivePermissions,
  hasPermission,
} from '../../shared/permissions'

/** ADMIN або MANAGER — ті самі права, що й адмін, окрім керування обліковими записами користувачів (лише ADMIN). */
export function isElevatedRole(role: string | undefined): boolean {
  return role === 'ADMIN' || role === 'MANAGER'
}

export function isStrictAdmin(role: string | undefined): boolean {
  return role === 'ADMIN'
}

/**
 * Завантажує ефективні дозволи поточного користувача (дефолти ролі + індивідуальні overrides).
 * Результат кешується на event.context, щоб не робити зайвих запитів у межах одного запиту.
 */
export async function getEffectivePermissions(event: H3Event): Promise<Set<string>> {
  const cached = event.context.permissions as Set<string> | undefined
  if (cached) {
    return cached
  }

  const auth = event.context.auth
  if (!auth) {
    return new Set()
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { role: true, permissionOverrides: true },
  })
  
  if (!dbUser) {
    return new Set()
  }

  const set = effectivePermissions(
    dbUser.role as Role,
    (dbUser.permissionOverrides ?? {}) as PermissionOverrides,
  )
  event.context.permissions = set
  return set
}

/** Перевіряє, чи має поточний користувач дозвіл (асинхронно — читає overrides з БД). */
export async function can(event: H3Event, permission: string): Promise<boolean> {
  const perms = await getEffectivePermissions(event)
  return perms.has(permission)
}

/** Кидає 403, якщо у користувача немає дозволу. Зручно ставити на початку handler-а. */
export async function requirePermission(event: H3Event, permission: string, statusMessage?: string): Promise<void> {
  if (!(await can(event, permission))) {
    throw createError({ statusCode: 403, statusMessage: statusMessage ?? 'Forbidden' })
  }
}

/** Синхронна перевірка, якщо роль і overrides вже відомі (напр. після окремого запиту). */
export function userHasPermission(
  role: string | undefined,
  overrides: PermissionOverrides | null | undefined,
  permission: string,
): boolean {
  if (!role) {
    return false
  }

  return hasPermission(role as Role, overrides, permission)
}
