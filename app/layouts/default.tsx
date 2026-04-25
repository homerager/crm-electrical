export default defineComponent({
  name: 'DefaultLayout',
  setup() {
    const { user, isAdmin, logout } = useAuth()
    const route = useRoute()
    const slots = useSlots()
    const drawer = ref(true)
    const rail = ref(false)

    const themeCookie = useCookie<'light' | 'dark'>('crm-theme', {
      default: () => 'dark',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
    const theme = computed({
      get: () => themeCookie.value,
      set: (val) => { themeCookie.value = val },
    })

    function toggleTheme() {
      theme.value = theme.value === 'light' ? 'dark' : 'light'
    }

    const userName = computed<string>(() => {
      const name = user.value?.name
      if (!name) return ''
      return typeof name === 'string' ? name : String(name)
    })
    const userRoleLabel = computed(() =>
      user.value?.role === 'ADMIN' ? 'Адміністратор' : 'Комірник',
    )

    const navItems = computed(() => {
      const base = [
        { title: 'Дашборд', icon: 'mdi-view-dashboard', to: '/' },
        { title: 'Склади', icon: 'mdi-warehouse', to: '/warehouses' },
        { title: 'Обʼєкти', icon: 'mdi-office-building-outline', to: '/objects' },
        { title: 'Товари', icon: 'mdi-package-variant-closed', to: '/products' },
        { title: 'Групи товарів', icon: 'mdi-tag-multiple', to: '/product-groups' },
        { title: 'Контрагенти', icon: 'mdi-domain', to: '/contractors' },
        { title: 'Накладні', icon: 'mdi-file-document-multiple', to: '/invoices' },
        { title: 'Переміщення', icon: 'mdi-swap-horizontal', to: '/movements' },
        { title: 'Репорти', icon: 'mdi-chart-bar', to: '/reports' },
        { title: 'Проєкти', icon: 'mdi-folder-multiple-outline', to: '/projects' },
        { title: 'Завдання', icon: 'mdi-checkbox-marked-circle-outline', to: '/tasks' },
        { title: 'Звіт завдань', icon: 'mdi-chart-bar', to: '/tasks/reports' },
        { title: 'Зарплатний звіт', icon: 'mdi-account-cash-outline', to: '/tasks/salary' },
      ]
      if (isAdmin.value) {
        base.push({ title: 'Користувачі', icon: 'mdi-account-group', to: '/users' })
      }
      return base
    })

    return () => (
      <v-app theme={theme.value}>

        {/* Navigation Drawer — all content in named slots to avoid [object Object] */}
        <v-navigation-drawer v-model={drawer.value} rail={rail.value} permanent>
          {{
            default: () => (
              <>
                <v-list-item
                  prepend-icon="mdi-lightning-bolt-circle"
                  title="CRM"
                  nav
                >
                  {{
                    append: () => (
                      <v-btn
                        variant="text"
                        icon={rail.value ? 'mdi-chevron-right' : 'mdi-chevron-left'}
                        onClick={() => (rail.value = !rail.value)}
                      />
                    ),
                  }}
                </v-list-item>

                <v-divider />

                <v-list density="compact" nav>
                  {navItems.value.map((item) => (
                    <v-list-item
                      key={item.to}
                      prepend-icon={item.icon}
                      title={item.title}
                      to={item.to}
                      active={route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to))}
                      active-color="primary"
                      rounded="lg"
                    />
                  ))}
                </v-list>
              </>
            ),
            append: () => (
              <>
                <v-divider />
                <v-list density="compact" nav class="pa-2">
                  {user.value && (
                    <v-list-item
                      prepend-icon="mdi-account-circle"
                      title={userName.value}
                      subtitle={userRoleLabel.value}
                    />
                  )}
                  <v-list-item
                    prepend-icon={theme.value === 'light' ? 'mdi-weather-night' : 'mdi-weather-sunny'}
                    title="Тема"
                    onClick={toggleTheme}
                    rounded="lg"
                  />
                  <v-list-item
                    prepend-icon="mdi-send"
                    title="Telegram бот"
                    href="https://t.me/proelectric_crm_bot"
                    target="_blank"
                    rounded="lg"
                    base-color="primary"
                  />
                  <v-list-item
                    prepend-icon="mdi-logout"
                    title="Вийти"
                    onClick={logout}
                    rounded="lg"
                    base-color="error"
                  />
                </v-list>
              </>
            ),
          }}
        </v-navigation-drawer>

        {/* App Bar — same fix: all content in named slots */}
        <v-app-bar elevation={1}>
          {{
            default: () => (
              <>
                <v-app-bar-nav-icon onClick={() => (drawer.value = !drawer.value)} />
                <v-app-bar-title>
                  <span class="text-body-1 font-weight-medium">{getPageTitle(route.path)}</span>
                </v-app-bar-title>
              </>
            ),
            append: () => (
              <>
                {user.value && (
                  <v-chip class="mr-3" prepend-icon="mdi-account-circle" variant="tonal" color="primary">
                    {userName.value}
                  </v-chip>
                )}
              </>
            ),
          }}
        </v-app-bar>

        <v-main style="background: var(--v-theme-background)">
          <v-container fluid class="pa-6">
            {slots.default?.()}
          </v-container>
        </v-main>

      </v-app>
    )
  },
})

function getPageTitle(path: string): string {
  const titles: Record<string, string> = {
    '/': 'Дашборд',
    '/warehouses': 'Склади',
    '/objects': 'Будівельні обʼєкти',
    '/products': 'Товари',
    '/product-groups': 'Групи товарів',
    '/contractors': 'Контрагенти',
    '/invoices': 'Накладні',
    '/movements': 'Переміщення',
    '/reports': 'Репорти',
    '/tasks': 'Завдання',
    '/users': 'Користувачі',
  }
  for (const [key, val] of Object.entries(titles)) {
    if (path === key || (key !== '/' && path.startsWith(key))) return val
  }
  return 'CRM'
}
