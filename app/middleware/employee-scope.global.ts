export default defineNuxtRouteMiddleware(async (to) => {
  const { user, initialized, fetchMe } = useAuth()

  if (!initialized.value) {
    await fetchMe()
  }

  if (!user.value || user.value.role !== 'EMPLOYEE') return

  if (to.path.startsWith('/login')) return

  const ok =
    to.path === '/' ||
    to.path.startsWith('/tasks') ||
    to.path.startsWith('/projects')

  if (!ok) {
    return navigateTo('/tasks')
  }
})
