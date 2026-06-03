export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'MANAGER' | 'STOREKEEPER' | 'USER' | 'EMPLOYEE'
  isActive: boolean
  emailNotifications: boolean
  jobTitle?: { id: string; name: string } | null
  /** Ефективні дозволи (дефолти ролі + індивідуальні overrides), напр. ['payments.view', ...] */
  permissions?: string[]
}

export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const initialized = useState<boolean>('auth-initialized', () => false)

  const isLoggedIn = computed(() => !!user.value)

  /** Повний доступ, включно з керуванням користувачами */
  const isAdmin = computed(() => user.value?.role === 'ADMIN')

  /** Як адмін, але без сторінки/ API користувачів */
  const isPrivileged = computed(
    () => user.value?.role === 'ADMIN' || user.value?.role === 'MANAGER',
  )

  const isEmployee = computed(() => user.value?.role === 'EMPLOYEE')

  /** Ефективні дозволи поточного користувача у вигляді Set для швидкої перевірки. */
  const permissions = computed(() => new Set(user.value?.permissions ?? []))

  /**
   * Перевірка дозволу на клієнті. ADMIN завжди має повний доступ.
   * Використання: const { can } = useAuth(); ... v-if={can('payments.edit')}
   */
  function can(permission: string): boolean {
    if (user.value?.role === 'ADMIN') {
      return true
    }
    
    return permissions.value.has(permission)
  }

  async function fetchMe() {
    try {
      const headers = import.meta.server ? useRequestHeaders(['cookie']) : {}
      const data = await $fetch<{ user: AuthUser }>('/api/auth/me', { headers })
      console.log('[useAuth] fetchMe raw data:', JSON.stringify(data))
      user.value = data.user
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
    return data.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    await navigateTo('/login')
  }

  return { user, isLoggedIn, isAdmin, isPrivileged, isEmployee, permissions, initialized, can, fetchMe, login, logout }
}
