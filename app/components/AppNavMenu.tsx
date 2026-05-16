type NavLeaf = { title: string; icon: string; to: string }
type NavSubGroup = { title: string; icon: string; value: string; children: NavLeaf[] }
type NavNode = NavLeaf | NavSubGroup
type NavSection = { title: string; icon: string; value: string; children: NavNode[] }

const isSubGroup = (node: NavNode): node is NavSubGroup => 'children' in node

export default defineComponent({
  name: 'AppNavMenu',
  setup() {
    const { isAdmin, isPrivileged, isEmployee } = useAuth()
    const route = useRoute()

    const dashboard: NavLeaf = { title: 'Дашборд', icon: 'mdi-view-dashboard', to: '/' }

    const sections = computed<NavSection[]>(() => {
      if (isEmployee.value) {
        return [
          {
            title: 'Проєкти',
            icon: 'mdi-briefcase-outline',
            value: 'projects',
            children: [
              { title: 'Проєкти', icon: 'mdi-folder-multiple-outline', to: '/projects' },
              { title: 'Завдання', icon: 'mdi-checkbox-marked-circle-outline', to: '/tasks' },
              { title: 'Календар завдань', icon: 'mdi-calendar-month-outline', to: '/tasks/calendar' },
            ],
          },
        ]
      }

      const projects: NavSection = {
        title: 'Проєкти',
        icon: 'mdi-briefcase-outline',
        value: 'projects',
        children: [
          { title: 'Проєкти', icon: 'mdi-folder-multiple-outline', to: '/projects' },
          { title: 'Завдання', icon: 'mdi-checkbox-marked-circle-outline', to: '/tasks' },
          { title: 'Календар завдань', icon: 'mdi-calendar-month-outline', to: '/tasks/calendar' },
        ],
      }
      if (isPrivileged.value) {
        projects.children.push({ title: 'Облік часу', icon: 'mdi-clock-plus-outline', to: '/time-logs/manual' })
        projects.children.push({ title: 'Звіт завдань', icon: 'mdi-chart-bar', to: '/tasks/reports' })
      }

      const reports: NavSection = {
        title: 'Звіти',
        icon: 'mdi-chart-box-outline',
        value: 'reports',
        children: [
          { title: 'Репорти', icon: 'mdi-chart-bar', to: '/reports' },
        ],
      }
      if (isAdmin.value) {
        reports.children.push({ title: 'Зарплатний звіт', icon: 'mdi-account-cash-outline', to: '/tasks/salary' })
      }

      const result: NavSection[] = [
        {
          title: 'Комерція',
          icon: 'mdi-handshake-outline',
          value: 'commerce',
          children: [
            { title: 'Клієнти', icon: 'mdi-account-tie', to: '/clients' },
            { title: 'Контрагенти', icon: 'mdi-domain', to: '/contractors' },
            {
              title: 'Комерційні пропозиції',
              icon: 'mdi-briefcase-edit-outline',
              value: 'proposals',
              children: [
                { title: 'Список КП', icon: 'mdi-file-document-multiple-outline', to: '/proposals' },
                { title: 'Товари для КП', icon: 'mdi-tag-text-outline', to: '/proposals/products' },
              ],
            },
            { title: 'Документи', icon: 'mdi-file-document-edit-outline', to: '/documents' },
            { title: 'Обʼєкти', icon: 'mdi-office-building-outline', to: '/objects' },
          ],
        },
        {
          title: 'Фінанси',
          icon: 'mdi-cash-multiple',
          value: 'finance',
          children: [
            { title: 'Оплати', icon: 'mdi-bank-transfer', to: '/payments' },
            { title: 'Графік платежів', icon: 'mdi-calendar-clock', to: '/payments/schedule' },
          ],
        },
        projects,
        {
          title: 'Склад і товари',
          icon: 'mdi-package-variant',
          value: 'warehouse',
          children: [
            { title: 'Склади', icon: 'mdi-warehouse', to: '/warehouses' },
            { title: 'Товари', icon: 'mdi-package-variant-closed', to: '/products' },
            { title: 'Групи товарів', icon: 'mdi-tag-multiple', to: '/product-groups' },
            { title: 'Переміщення', icon: 'mdi-swap-horizontal', to: '/movements' },
          ],
        },
        {
          title: 'Закупівля',
          icon: 'mdi-cart-outline',
          value: 'purchase',
          children: [
            { title: 'Накладні', icon: 'mdi-file-document-multiple', to: '/invoices' },
            { title: 'Заявки на закупівлю', icon: 'mdi-cart-arrow-down', to: '/purchase-requests' },
          ],
        },
        reports,
      ]

      if (isAdmin.value) {
        result.push({
          title: 'Адміністрування',
          icon: 'mdi-shield-crown-outline',
          value: 'admin-settings',
          children: [
            { title: 'Загальні', icon: 'mdi-cog-outline', to: '/settings' },
            { title: 'Користувачі', icon: 'mdi-account-group', to: '/users' },
            { title: 'Посади', icon: 'mdi-badge-account-horizontal-outline', to: '/job-titles' },
            { title: 'Журнал змін', icon: 'mdi-history', to: '/audit-log' },
          ],
        })
      }
      return result
    })

    /** Most specific route the current path matches — only one nav item is highlighted at a time. */
    const activeLeaf = computed(() => {
      const matches = (to: string) =>
        to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(to + '/')
      let best = ''
      const consider = (to: string) => {
        if (matches(to) && to.length > best.length) best = to
      }
      consider(dashboard.to)
      for (const section of sections.value) {
        for (const node of section.children) {
          if (isSubGroup(node)) node.children.forEach((c) => consider(c.to))
          else consider(node.to)
        }
      }
      return best
    })

    /** Sections / subgroups that contain the active route — kept open and highlighted. */
    const openedGroups = computed(() => {
      const open: string[] = []
      for (const section of sections.value) {
        for (const node of section.children) {
          if (isSubGroup(node)) {
            if (node.children.some((c) => c.to === activeLeaf.value)) {
              open.push(section.value, node.value)
            }
          } else if (node.to === activeLeaf.value) {
            open.push(section.value)
          }
        }
      }
      return open
    })

    const renderLeaf = (leaf: NavLeaf) => (
      <v-list-item
        key={leaf.to}
        prepend-icon={leaf.icon}
        title={leaf.title}
        to={leaf.to}
        active={activeLeaf.value === leaf.to}
        active-color="primary"
        rounded="lg"
      />
    )

    const renderGroup = (
      value: string,
      title: string,
      icon: string,
      active: boolean,
      children: () => unknown,
    ) => (
      <v-list-group key={value} value={value}>
        {{
          activator: ({ props }: { props: Record<string, unknown> }) => (
            <v-list-item
              {...props}
              prepend-icon={icon}
              title={title}
              active={active}
              active-color="primary"
              rounded="lg"
            />
          ),
          default: children,
        }}
      </v-list-group>
    )

    const renderNode = (node: NavNode) => {
      if (isSubGroup(node)) {
        const active = node.children.some((c) => c.to === activeLeaf.value)
        return renderGroup(node.value, node.title, node.icon, active, () =>
          node.children.map(renderLeaf),
        )
      }
      return renderLeaf(node)
    }

    return () => (
      <v-list density="compact" nav opened={openedGroups.value}>
        {renderLeaf(dashboard)}
        {sections.value.map((section) =>
          renderGroup(
            section.value,
            section.title,
            section.icon,
            openedGroups.value.includes(section.value),
            () => section.children.map(renderNode),
          ),
        )}
      </v-list>
    )
  },
})
