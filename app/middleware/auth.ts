export default defineNuxtRouteMiddleware(async (to) => {
  const { isLoggedIn, fetchMe, initialized } = useAuth()

  if (!initialized.value) {
    await fetchMe()
  }

  const publicRoutes = ['/login']
  if (publicRoutes.includes(to.path)) {
    if (isLoggedIn.value) return navigateTo('/')
    return
  }

  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }
})
