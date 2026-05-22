import { isElevatedRole } from '../utils/authz'

/**
 * API фінансів (оплати) — лише для ADMIN та MANAGER.
 */
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  if (!url.pathname.startsWith('/api/payments')) return

  const auth = event.context.auth
  if (!isElevatedRole(auth?.role)) {
    throw createError({ statusCode: 403, message: 'Недостатньо прав' })
  }
})
