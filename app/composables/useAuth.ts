export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'STOREKEEPER'
  isActive: boolean
}

export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const initialized = useState<boolean>('auth-initialized', () => false)

  const isLoggedIn = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')

  async function fetchMe() {
    try {
      const headers = import.meta.server ? useRequestHeaders(['cookie']) : {}
      const data = await $fetch<{ user: AuthUser }>('/api/auth/me', { headers })
      console.log('[useAuth] fetchMe raw data:', JSON.stringify(data))
      user.value = data.user
      console.log('[useAuth] user.value.name after set:', user.value?.name, typeof user.value?.name)
    } catch (e) {
      console.error('[useAuth] fetchMe error:', e)
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  async function login(email: string, password: string) {
    const data = await $fetch<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    console.log('[useAuth] login raw data:', JSON.stringify(data))
    user.value = data.user
    console.log('[useAuth] user.value.name after login:', user.value?.name, typeof user.value?.name)
    return data.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    await navigateTo('/login')
  }

  return { user, isLoggedIn, isAdmin, initialized, fetchMe, login, logout }
}
