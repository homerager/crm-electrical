import { useDisplay } from 'vuetify'

export default defineComponent({
  name: 'DefaultLayout',
  setup() {
    const { user, isAdmin, isPrivileged, isEmployee, logout } = useAuth()
    const route = useRoute()
    const slots = useSlots()
    const display = useDisplay()
    /**
     * На SSR у Vuetify `display.width === 0` → `smAndDown` завжди true → рендериться temporary drawer + інший layout,
     * після гідрації на десктопі стан інший — «не клікається» до повного клієнтського оновлення (як після HMR).
     * На сервері завжди десктопний режим (permanent), реальну ширину застосовуємо лише в браузері.
     */
    const drawerOverlayMode = computed(() => {
      if (import.meta.server) return false
      return display.smAndDown.value
    })
    const drawer = ref(true)
    const rail = ref(false)

    watch(
      () => drawerOverlayMode.value,
      (narrow) => {
        if (narrow) {
          rail.value = false
          drawer.value = false
        } else {
          drawer.value = true
        }
      },
      { immediate: true },
    )

    watch(
      () => route.fullPath,
      () => {
        if (drawerOverlayMode.value) drawer.value = false
      },
    )

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
    const userRoleLabel = computed(() => {
      if (user.value?.role === 'ADMIN') return 'Адміністратор'
      if (user.value?.role === 'MANAGER') return 'Менеджер'
      if (user.value?.role === 'USER') return 'Користувач'
      if (user.value?.role === 'EMPLOYEE') return 'Працівник'
      return 'Комірник'
    })

    const userDrawerSubtitle = computed(() => {
      const role = userRoleLabel.value
      const jt = user.value?.jobTitle?.name
      return jt ? `${role} · ${jt}` : role
    })

    const navItems = computed(() => {
      if (isEmployee.value) {
        return [
          { title: 'Дашборд', icon: 'mdi-view-dashboard', to: '/' },
          { title: 'Проєкти', icon: 'mdi-folder-multiple-outline', to: '/projects' },
          { title: 'Завдання', icon: 'mdi-checkbox-marked-circle-outline', to: '/tasks' },
        ]
      }
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
      ]
      if (isPrivileged.value) {
        base.push({ title: 'Облік часу', icon: 'mdi-clock-plus-outline', to: '/time-logs/manual' })
        base.push({ title: 'Звіт завдань', icon: 'mdi-chart-bar', to: '/tasks/reports' })
      }
      if (isAdmin.value) {
        base.push({ title: 'Зарплатний звіт', icon: 'mdi-account-cash-outline', to: '/tasks/salary' })
        base.push({ title: 'Користувачі', icon: 'mdi-account-group', to: '/users' })
        base.push({ title: 'Посади', icon: 'mdi-badge-account-horizontal-outline', to: '/job-titles' })
        base.push({ title: 'Журнал змін', icon: 'mdi-history', to: '/audit-log' })
      }
      return base
    })

    return () => (
      <v-app theme={theme.value}>

        {/* Navigation Drawer — all content in named slots to avoid [object Object] */}
        <v-navigation-drawer
          modelValue={drawer.value}
          onUpdate:modelValue={(v: boolean) => { drawer.value = v }}
          rail={drawerOverlayMode.value ? false : rail.value}
          temporary={drawerOverlayMode.value}
          permanent={!drawerOverlayMode.value}
          mobile={false}
        >
          {{
            default: () => (
              <>
                <v-list-item
                  prepend-icon="mdi-lightning-bolt-circle"
                  title="CRM"
                  nav
                >
                  {{
                    append: () =>
                      !drawerOverlayMode.value
                        ? (
                            <v-btn
                              variant="text"
                              icon={rail.value ? 'mdi-chevron-right' : 'mdi-chevron-left'}
                              onClick={() => (rail.value = !rail.value)}
                            />
                          )
                        : null,
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
          }}
        </v-navigation-drawer>

        {/* App Bar — same fix: all content in named slots */}
        <v-app-bar elevation={1}>
          {{
            default: () => (
              <>
                <v-app-bar-nav-icon onClick={() => (drawer.value = !drawer.value)} />
                <v-app-bar-title class="min-w-0">
                  <span class="text-body-1 font-weight-medium text-truncate d-block">
                    {getPageTitle(route.path)}
                  </span>
                </v-app-bar-title>
              </>
            ),
            append: () => (
              <>
                {user.value && (
                  <v-menu location="bottom end" offset={8}>
                    {{
                      activator: ({ props }: { props: Record<string, unknown> }) => (
                        <v-btn
                          {...props}
                          class="mr-2 text-none text-truncate"
                          style={{ maxWidth: display.smAndDown.value ? 'min(52vw, 200px)' : undefined }}
                          prepend-icon="mdi-account-circle"
                          variant="tonal"
                          color="primary"
                          rounded="lg"
                        >
                          {userName.value}
                        </v-btn>
                      ),
                      default: () => (
                        <v-list density="compact" nav class="py-1" min-width={240}>
                          <v-list-item
                            prepend-icon="mdi-account-circle"
                            title={userName.value}
                            subtitle={userDrawerSubtitle.value}
                          />
                          <v-divider class="my-1" />
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
                            rel="noopener noreferrer"
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
                      ),
                    }}
                  </v-menu>
                )}
              </>
            ),
          }}
        </v-app-bar>

        <v-main style="background: var(--v-theme-background)">
          <v-container fluid class="pa-4 pa-sm-6">
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
    '/time-logs/manual': 'Облік часу',
    '/projects': 'Проєкти',
    '/users': 'Користувачі',
    '/job-titles': 'Посади',
    '/audit-log': 'Журнал змін',
  }
  for (const [key, val] of Object.entries(titles)) {
    if (path === key || (key !== '/' && path.startsWith(key))) return val
  }
  return 'CRM'
}
