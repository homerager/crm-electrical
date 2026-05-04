/** Лише роль ADMIN (не MANAGER). */
export default defineNuxtRouteMiddleware(async () => {
  const { isAdmin, fetchMe, initialized } = useAuth()

  if (!initialized.value) {
    await fetchMe()
  }

  if (!isAdmin.value) {
    return navigateTo('/tasks')
  }
})
