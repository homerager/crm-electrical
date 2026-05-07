/**
 * Обмежує API для ролі EMPLOYEE: лише завдання, проєкти, вкладення, time-logs та список виконавців.
 */
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const path = url.pathname
  if (!path.startsWith('/api/')) return

  const auth = event.context.auth
  if (!auth || auth.role !== 'EMPLOYEE') return

  const allowed =
    path.startsWith('/api/auth/')
    || path.startsWith('/api/tasks')
    || path.startsWith('/api/projects')
    || path.startsWith('/api/attachments/')
    || path.startsWith('/api/time-logs/')
    || path.startsWith('/api/audit-logs')
    || path === '/api/users/list'

  if (!allowed) {
    throw createError({ statusCode: 403, statusMessage: 'Недостатньо прав' })
  }
})
