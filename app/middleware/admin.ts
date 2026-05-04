export default defineNuxtRouteMiddleware(async () => {
  const { isPrivileged, fetchMe, initialized } = useAuth()

  if (!initialized.value) {
    await fetchMe()
  }

  if (!isPrivileged.value) {
    return navigateTo('/tasks')
  }
})
