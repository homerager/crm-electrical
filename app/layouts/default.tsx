import { useDisplay } from 'vuetify'
import { useNotifications, type AppNotification } from '~/composables/useNotifications'

export default defineComponent({
  name: 'DefaultLayout',
  setup() {
    const { user, isAdmin, isPrivileged, isEmployee, logout } = useAuth()
    const route = useRoute()
    const slots = useSlots()
    const display = useDisplay()
    const {
      items: notifications,
      unreadCount,
      loading: notifLoading,
      fetchNotifications,
      markAsRead,
      markAllAsRead,
      remove: removeNotification,
      startPolling,
      stopPolling,
    } = useNotifications()

    const notifMenuOpen = ref(false)
    const previousUnreadCount = ref<number | null>(null)
    let notificationAudioContext: AudioContext | null = null

    watch(notifMenuOpen, (open) => {
      if (open) fetchNotifications()
    })

    watch(
      () => user.value?.id,
      (userId) => {
        if (!userId) return
        fetchNotifications()
        startPolling()
      },
      { immediate: true },
    )

    watch(unreadCount, (count) => {
      if (previousUnreadCount.value === null) {
        previousUnreadCount.value = count
        return
      }
      if (count > previousUnreadCount.value) playNotificationSound()
      previousUnreadCount.value = count
    })

    onUnmounted(() => { stopPolling() })
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

    function playNotificationSound() {
      if (import.meta.server) return
      try {
        const AudioContextCtor = window.AudioContext
          || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AudioContextCtor) return

        notificationAudioContext ??= new AudioContextCtor()
        const ctx = notificationAudioContext
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        const now = ctx.currentTime

        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(880, now)
        oscillator.frequency.setValueAtTime(660, now + 0.11)

        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24)

        oscillator.connect(gain)
        gain.connect(ctx.destination)
        oscillator.start(now)
        oscillator.stop(now + 0.25)
      } catch {
        // Browsers may block audio until the user interacts with the page.
      }
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

    function handleNotificationClick(n: AppNotification) {
      if (!n.isRead) markAsRead(n.id)
      if (n.link) navigateTo(n.link)
      notifMenuOpen.value = false
    }

    function timeAgo(dateStr: string): string {
      const diff = Date.now() - new Date(dateStr).getTime()
      const mins = Math.floor(diff / 60_000)
      if (mins < 1) return 'щойно'
      if (mins < 60) return `${mins} хв тому`
      const hours = Math.floor(mins / 60)
      if (hours < 24) return `${hours} год тому`
      const days = Math.floor(hours / 24)
      if (days < 7) return `${days} дн тому`
      return new Date(dateStr).toLocaleDateString('uk-UA')
    }

    type NavLeaf  = { title: string; icon: string; to: string }
    type NavGroup = { title: string; icon: string; group: string; children: NavLeaf[] }
    type NavItem  = NavLeaf | NavGroup

    const adminSettingsPaths = ['/users', '/job-titles', '/audit-log', '/settings']

    const navItems = computed((): NavItem[] => {
      if (isEmployee.value) {
        return [
          { title: 'Дашборд', icon: 'mdi-view-dashboard', to: '/' },
          { title: 'Проєкти', icon: 'mdi-folder-multiple-outline', to: '/projects' },
          { title: 'Завдання', icon: 'mdi-checkbox-marked-circle-outline', to: '/tasks' },
        ]
      }
      const base: NavItem[] = [
        { title: 'Дашборд', icon: 'mdi-view-dashboard', to: '/' },
        { title: 'Склади', icon: 'mdi-warehouse', to: '/warehouses' },
        { title: 'Обʼєкти', icon: 'mdi-office-building-outline', to: '/objects' },
        { title: 'Товари', icon: 'mdi-package-variant-closed', to: '/products' },
        { title: 'Групи товарів', icon: 'mdi-tag-multiple', to: '/product-groups' },
        { title: 'Клієнти', icon: 'mdi-account-tie', to: '/clients' },
        { title: 'Контрагенти', icon: 'mdi-domain', to: '/contractors' },
        { title: 'Накладні', icon: 'mdi-file-document-multiple', to: '/invoices' },
        { title: 'Заявки на закупівлю', icon: 'mdi-cart-arrow-down', to: '/purchase-requests' },
        { title: 'Документи', icon: 'mdi-file-document-edit-outline', to: '/documents' },
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
        base.push({
          title: 'Налаштування',
          icon: 'mdi-cog-outline',
          group: 'admin-settings',
          children: [
            { title: 'Користувачі', icon: 'mdi-account-group', to: '/users' },
            { title: 'Посади', icon: 'mdi-badge-account-horizontal-outline', to: '/job-titles' },
            { title: 'Журнал змін', icon: 'mdi-history', to: '/audit-log' },
            { title: 'Загальні', icon: 'mdi-cog-outline', to: '/settings' },
          ],
        })
      }
      return base
    })

    const openedGroups = computed(() =>
      adminSettingsPaths.some((p) => route.path === p || route.path.startsWith(p + '/'))
        ? ['admin-settings']
        : [],
    )


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

                <v-list density="compact" nav opened={openedGroups.value}>
                  {navItems.value.map((item) => {
                    if ('children' in item) {
                      const anyChildActive = item.children.some(
                        (c) => route.path === c.to || route.path.startsWith(c.to + '/'),
                      )
                      return (
                        <v-list-group key={item.group} value={item.group}>
                          {{
                            activator: ({ props }: { props: Record<string, unknown> }) => (
                              <v-list-item
                                {...props}
                                prepend-icon={item.icon}
                                title={item.title}
                                active={anyChildActive}
                                active-color="primary"
                                rounded="lg"
                              />
                            ),
                            default: () => item.children.map((child) => (
                              <v-list-item
                                key={child.to}
                                prepend-icon={child.icon}
                                title={child.title}
                                to={child.to}
                                active={route.path === child.to || route.path.startsWith(child.to + '/')}
                                active-color="primary"
                                rounded="lg"
                              />
                            )),
                          }}
                        </v-list-group>
                      )
                    }
                    return (
                      <v-list-item
                        key={item.to}
                        prepend-icon={item.icon}
                        title={item.title}
                        to={item.to}
                        active={route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to))}
                        active-color="primary"
                        rounded="lg"
                      />
                    )
                  })}
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
                  <>
                    {/* Notification bell */}
                    <v-menu
                      modelValue={notifMenuOpen.value}
                      onUpdate:modelValue={(v: boolean) => { notifMenuOpen.value = v }}
                      location="bottom end"
                      offset={8}
                      close-on-content-click={false}
                      max-width={400}
                      min-width={340}
                    >
                      {{
                        activator: ({ props: menuProps }: { props: Record<string, unknown> }) => (
                          <v-btn
                            {...menuProps}
                            icon
                            variant="text"
                            class="mr-1"
                          >
                            <v-badge
                              color="error"
                              content={unreadCount.value}
                              modelValue={unreadCount.value > 0}
                              floating
                              max={99}
                            >
                              <v-icon>mdi-bell-outline</v-icon>
                            </v-badge>
                          </v-btn>
                        ),
                        default: () => (
                          <v-card>
                            <v-card-title class="d-flex align-center py-2 px-4">
                              <span class="text-subtitle-1 font-weight-bold">Сповіщення</span>
                              <v-spacer />
                              {unreadCount.value > 0 && (
                                <v-btn
                                  variant="text"
                                  size="small"
                                  color="primary"
                                  class="text-none"
                                  onClick={() => markAllAsRead()}
                                >
                                  Прочитати все
                                </v-btn>
                              )}
                            </v-card-title>
                            <v-divider />
                            <v-list
                              density="compact"
                              class="py-0"
                              style={{ maxHeight: '360px', overflowY: 'auto' }}
                            >
                              {notifLoading.value && !notifications.value.length ? (
                                <v-list-item class="text-center py-4">
                                  <v-progress-circular indeterminate size={24} />
                                </v-list-item>
                              ) : notifications.value.length === 0 ? (
                                <v-list-item class="text-center py-6">
                                  <v-list-item-title class="text-medium-emphasis">
                                    Немає сповіщень
                                  </v-list-item-title>
                                </v-list-item>
                              ) : (
                                notifications.value.map((n) => (
                                  <v-list-item
                                    key={n.id}
                                    class={n.isRead ? '' : 'bg-surface-light'}
                                    onClick={() => handleNotificationClick(n)}
                                    style={{ cursor: n.link ? 'pointer' : 'default' }}
                                  >
                                    {{
                                      prepend: () => (
                                        <v-icon
                                          color={n.isRead ? 'grey' : 'primary'}
                                          size="small"
                                          class="mr-3 mt-1"
                                        >
                                          {n.isRead ? 'mdi-bell-check-outline' : 'mdi-bell-ring-outline'}
                                        </v-icon>
                                      ),
                                      default: () => (
                                        <div>
                                          <div class={`text-body-2 ${n.isRead ? 'text-medium-emphasis' : 'font-weight-medium'}`}>
                                            {n.title}
                                          </div>
                                          {n.body && (
                                            <div class="text-caption text-medium-emphasis text-truncate" style={{ maxWidth: '260px' }}>
                                              {n.body}
                                            </div>
                                          )}
                                          <div class="text-caption text-disabled mt-1">
                                            {timeAgo(n.createdAt)}
                                          </div>
                                        </div>
                                      ),
                                      append: () => (
                                        <v-btn
                                          icon="mdi-close"
                                          variant="text"
                                          size="x-small"
                                          color="grey"
                                          onClick={(e: MouseEvent) => {
                                            e.stopPropagation()
                                            removeNotification(n.id)
                                          }}
                                        />
                                      ),
                                    }}
                                  </v-list-item>
                                ))
                              )}
                            </v-list>
                          </v-card>
                        ),
                      }}
                    </v-menu>

                    {/* User menu */}
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
                  </>
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
    '/clients': 'Клієнти',
    '/contractors': 'Контрагенти',
    '/invoices': 'Накладні',
    '/purchase-requests': 'Заявки на закупівлю',
    '/documents': 'Шаблони документів',
    '/movements': 'Переміщення',
    '/reports': 'Репорти',
    '/tasks': 'Завдання',
    '/time-logs/manual': 'Облік часу',
    '/projects': 'Проєкти',
    '/users': 'Користувачі',
    '/job-titles': 'Посади',
    '/audit-log': 'Журнал змін',
    '/settings': 'Налаштування CRM',
  }
  for (const [key, val] of Object.entries(titles)) {
    if (path === key || (key !== '/' && path.startsWith(key))) return val
  }
  return 'CRM'
}
