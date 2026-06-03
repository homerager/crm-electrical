/**
 * Бічне меню. Видимість пунктів повністю керується дозволами (can('<module>.<action>')).
 * Структура описана декларативно одним деревом; рекурсивний фільтр прибирає
 * недоступні пункти та порожні групи, рекурсивний рендер малює будь-яку глибину.
 */
type NavItem = {
  title: string
  icon: string
  /** Лист — навігаційний пункт. Групи `to` не мають. */
  to?: string
  /** Унікальний ключ групи (для v-list-group). */
  value?: string
  /** Дозвіл, потрібний щоб побачити пункт. Без нього пункт видимий усім. */
  perm?: string
  children?: NavItem[]
}

const isGroup = (node: NavItem): boolean => Array.isArray(node.children) && node.children.length > 0

export default defineComponent({
  name: 'AppNavMenu',
  setup() {
    const { can } = useAuth()
    const route = useRoute()

    const dashboard: NavItem = { title: 'Дашборд', icon: 'mdi-view-dashboard', to: '/' }

    /** Повне меню. Кожен пункт гейтиться своїм дозволом — видимість визначають лише дозволи. */
    const fullTree: NavItem[] = [
      { title: 'Клієнти', icon: 'mdi-account-tie', to: '/clients', perm: 'clients.view' },
      {
        title: 'Комерційні пропозиції',
        icon: 'mdi-briefcase-edit-outline',
        value: 'proposals',
        perm: 'proposals.view',
        children: [
          { title: 'Список КП', icon: 'mdi-file-document-multiple-outline', to: '/proposals' },
          { title: 'Товари для КП', icon: 'mdi-tag-text-outline', to: '/proposals/products' },
        ],
      },
      {
        title: 'Склад і товари',
        icon: 'mdi-package-variant',
        value: 'warehouse',
        children: [
          { title: 'Склади', icon: 'mdi-warehouse', to: '/warehouses', perm: 'warehouses.view' },
          { title: 'Товари', icon: 'mdi-package-variant-closed', to: '/products', perm: 'products.view' },
          { title: 'Групи товарів', icon: 'mdi-tag-multiple', to: '/product-groups', perm: 'products.view' },
          { title: 'Переміщення', icon: 'mdi-swap-horizontal', to: '/movements', perm: 'warehouses.view' },
          { title: 'Інвентаризація', icon: 'mdi-clipboard-list-outline', to: '/inventory', perm: 'inventory.view' },
        ],
      },
      {
        title: 'Обладнання',
        icon: 'mdi-toolbox-outline',
        value: 'equipment',
        perm: 'equipment.view',
        children: [
          { title: 'Список', icon: 'mdi-format-list-bulleted', to: '/equipment' },
          { title: 'Сканер', icon: 'mdi-qrcode-scan', to: '/equipment/scan' },
          { title: 'Інвентаризація', icon: 'mdi-clipboard-check-outline', to: '/equipment/inventory' },
        ],
      },
      {
        title: 'Проєкти',
        icon: 'mdi-briefcase-outline',
        value: 'projects',
        children: [
          { title: 'Список проєктів', icon: 'mdi-folder-multiple-outline', to: '/projects', perm: 'projects.view' },
          { title: 'Обʼєкти', icon: 'mdi-office-building-outline', to: '/objects', perm: 'objects.view' },
          { title: 'Документи', icon: 'mdi-file-document-edit-outline', to: '/documents', perm: 'documents.view' },
          { title: 'Завдання', icon: 'mdi-checkbox-marked-circle-outline', to: '/tasks', perm: 'tasks.view' },
          { title: 'Календар завдань', icon: 'mdi-calendar-month-outline', to: '/tasks/calendar', perm: 'tasks.view' },
          { title: 'Звіт завдань', icon: 'mdi-chart-bar', to: '/tasks/reports', perm: 'tasks.view' },
          { title: 'Розклад', icon: 'mdi-calendar-account-outline', to: '/schedule', perm: 'schedules.view' },
          { title: 'Журнал робіт', icon: 'mdi-notebook-edit-outline', to: '/time-logs/manual', perm: 'schedules.manage' },
        ],
      },
      {
        title: 'Фінанси',
        icon: 'mdi-cash-multiple',
        value: 'finance',
        children: [
          { title: 'Фін. дашборд', icon: 'mdi-finance', to: '/finance-dashboard', perm: 'payments.dashboard' },
          { title: 'Оплати', icon: 'mdi-bank-transfer', to: '/payments', perm: 'payments.view' },
          { title: 'Графік платежів', icon: 'mdi-calendar-clock', to: '/payments/schedule', perm: 'paymentSchedules.view' },
        ],
      },
      {
        title: 'Закупівля',
        icon: 'mdi-cart-outline',
        value: 'purchase',
        children: [
          { title: 'Контрагенти', icon: 'mdi-domain', to: '/contractors', perm: 'contractors.view' },
          { title: 'Накладні', icon: 'mdi-file-document-multiple', to: '/invoices', perm: 'invoices.view' },
          { title: 'Прайс-листи постачальників', icon: 'mdi-tag-multiple-outline', to: '/supplier-prices', perm: 'supplierPrices.view' },
          { title: 'Заявки на закупівлю', icon: 'mdi-cart-arrow-down', to: '/purchase-requests', perm: 'purchaseRequests.view' },
        ],
      },
      {
        title: 'Звіти',
        icon: 'mdi-chart-box-outline',
        value: 'reports',
        children: [
          { title: 'Репорти', icon: 'mdi-chart-bar', to: '/reports', perm: 'reports.view' },
          { title: 'Фото-звіти', icon: 'mdi-camera-burst', to: '/photo-reports', perm: 'photoReports.view' },
          { title: 'Зарплатний звіт', icon: 'mdi-account-cash-outline', to: '/tasks/salary', perm: 'reports.salary' },
        ],
      },
      {
        title: 'Адміністрування',
        icon: 'mdi-shield-crown-outline',
        value: 'admin-settings',
        children: [
          { title: 'Загальні', icon: 'mdi-cog-outline', to: '/settings', perm: 'settings.manage' },
          { title: 'Користувачі', icon: 'mdi-account-group', to: '/users', perm: 'users.view' },
          { title: 'Посади', icon: 'mdi-badge-account-horizontal-outline', to: '/job-titles', perm: 'settings.manage' },
          { title: 'Журнал змін', icon: 'mdi-history', to: '/audit-log', perm: 'auditLog.view' },
        ],
      },
    ]

    /** Рекурсивно прибирає недоступні пункти та порожні групи. */
    function filterTree(items: NavItem[]): NavItem[] {
      const out: NavItem[] = []
      for (const item of items) {
        if (item.perm && !can(item.perm)) {
          continue
        }
        if (isGroup(item)) {
          const children = filterTree(item.children!)
          if (children.length === 0) {
            continue
          }
          out.push({ ...item, children })
        } else if (item.to) {
          out.push(item)
        }
      }
      return out
    }

    const sections = computed<NavItem[]>(() => filterTree(fullTree))

    /** Most specific route the current path matches — only one nav item is highlighted at a time. */
    const activeLeaf = computed(() => {
      const matches = (to: string) =>
        to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(to + '/')
      let best = ''
      const walk = (items: NavItem[]) => {
        for (const item of items) {
          if (isGroup(item)) walk(item.children!)
          else if (item.to && matches(item.to) && item.to.length > best.length) best = item.to
        }
      }
      if (matches(dashboard.to!)) best = dashboard.to!
      walk(sections.value)
      return best
    })

    /** Групи на шляху до активного листа — лишаються відкритими. */
    const openedGroups = computed(() => {
      const path = (items: NavItem[]): string[] | null => {
        for (const item of items) {
          if (isGroup(item)) {
            const sub = path(item.children!)
            if (sub) return item.value ? [item.value, ...sub] : sub
          } else if (item.to === activeLeaf.value) {
            return []
          }
        }
        return null
      }
      return path(sections.value) ?? []
    })

    const renderLeaf = (leaf: NavItem) => (
      <v-list-item
        key={leaf.to}
        prepend-icon={leaf.icon}
        title={leaf.title}
        to={leaf.to}
        active={activeLeaf.value === leaf.to}
        color="primary"
        rounded="lg"
      />
    )

    const renderNode = (node: NavItem): unknown => {
      if (!isGroup(node)) return renderLeaf(node)
      const active = openedGroups.value.includes(node.value ?? '')
      return (
        <v-list-group key={node.value} value={node.value}>
          {{
            activator: ({ props }: { props: Record<string, unknown> }) => (
              <v-list-item
                {...props}
                prepend-icon={node.icon}
                title={node.title}
                active={active}
                color="primary"
                rounded="lg"
              />
            ),
            default: () => node.children!.map(renderNode),
          }}
        </v-list-group>
      )
    }

    return () => (
      <v-list density="compact" nav opened={openedGroups.value}>
        {renderLeaf(dashboard)}
        {sections.value.map(renderNode)}
      </v-list>
    )
  },
})
