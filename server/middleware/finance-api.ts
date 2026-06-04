import { can } from '../utils/authz'

/**
 * Базовий гейт API фінансів: для доступу до /api/payments потрібен щонайменше
 * дозвіл payments.view. Точніші перевірки (create/edit/delete) — у самих ендпоінтах.
 */
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  if (!url.pathname.startsWith('/api/payments')) return

  if (!(await can(event, 'payments.view'))) {
    throw createError({ statusCode: 403, message: 'Недостатньо прав' })
  }
})
