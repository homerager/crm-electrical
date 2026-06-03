import { requiredPermissionForPath } from '~~/shared/permissions'

/**
 * Глобальний перехоплювач доступу: якщо маршрут вимагає дозволу, якого немає
 * у користувача, — повертаємо на дашборд. Аутентифікацію (редірект на /login)
 * обробляє окрема page-middleware ['auth'], тут лише авторизація по дозволах.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { user, initialized, fetchMe, can } = useAuth()

  if (!initialized.value) {
    await fetchMe()
  }

  // Неавторизованих не чіпаємо — цим займається auth-middleware/сторінка логіну.
  if (!user.value) {
    return
  }

  // Пріоритет: явний дозвіл на сторінці (definePageMeta({ permission: '...' })),
  // інакше — карта префіксів. Meta-варіант точно гейтить динамічні маршрути (/tasks/[id]).
  const perm = (to.meta.permission as string | undefined) ?? requiredPermissionForPath(to.path)
  if (perm && !can(perm)) {
    // Немає доступу до сторінки — на дашборд (він відкритий усім авторизованим).
    if (to.path !== '/') {
      return navigateTo('/')
    }
  }
})
