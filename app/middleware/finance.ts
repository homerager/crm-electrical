/** Блокує роль USER ("Користувач") від перегляду фінансів (оплати, графік платежів). */
export default defineNuxtRouteMiddleware(async () => {
  const { isUser, fetchMe, initialized } = useAuth()

  if (!initialized.value) {
    await fetchMe()
  }

  if (isUser.value) {
    return navigateTo('/')
  }
})
