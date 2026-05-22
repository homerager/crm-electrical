/**
 * Блокує API фінансів (оплати) для ролі USER ("Користувач").
 */
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  if (!url.pathname.startsWith('/api/payments')) return

  const auth = event.context.auth
  if (auth?.role === 'USER') {
    throw createError({ statusCode: 403, message: 'Недостатньо прав' })
  }
})
