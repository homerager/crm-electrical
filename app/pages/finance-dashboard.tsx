import { useTheme } from 'vuetify'

export default defineComponent({
  name: 'FinanceDashboardPage',
  setup() {
    definePageMeta({ middleware: ['auth', 'admin-only'] })

    useHead({ title: 'Фінансовий дашборд' })

    const theme = useTheme()
    const isDark = computed(() => theme.global.current.value.dark)
    const chartFg = computed(() => isDark.value ? '#BDBDBD' : '#616161')
    const chartGrid = computed(() => isDark.value ? '#333333' : '#E0E0E0')
    const mounted = ref(false)
    onMounted(() => { mounted.value = true })

    const cashFlowMonths = ref(6)
    const { data: summaryData } = useFetch('/api/payments/summary', {
      query: computed(() => ({ months: cashFlowMonths.value })),
      watch: [cashFlowMonths],
    })
    const { data: debtsData } = useFetch('/api/payments/debts')
    const { data: schedulesData } = useFetch('/api/payment-schedules')
    const { data: profitData } = useFetch('/api/reports/object-profitability')

    const summary = computed(() => summaryData.value as any ?? {})
    const debts = computed(() => debtsData.value as any ?? {})
    const schedules = computed(() => (schedulesData.value as any)?.schedules ?? [])
    const profitability = computed(() => (profitData.value as any)?.objects ?? [])

    function uah(n: number) {
      return n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₴'
    }

    function baseChartOpts(overrides: Record<string, any> = {}): Record<string, any> {
      return {
        chart: {
          background: 'transparent',
          toolbar: { show: false },
          fontFamily: 'inherit',
          ...overrides.chart,
        },
        theme: { mode: isDark.value ? 'dark' as const : 'light' as const },
        grid: { borderColor: chartGrid.value, ...overrides.grid },
        xaxis: {
          labels: { style: { colors: chartFg.value } },
          ...overrides.xaxis,
        },
        yaxis: {
          labels: { style: { colors: chartFg.value } },
          ...overrides.yaxis,
        },
        tooltip: { theme: isDark.value ? 'dark' : 'light', ...overrides.tooltip },
        legend: { labels: { colors: chartFg.value }, ...overrides.legend },
        ...overrides,
      }
    }

    // Stats
    const monthIncoming = computed(() => {
      const cf = summary.value?.cashFlow
      if (!cf || !cf.length) return 0
      const now = new Date()
      const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const current = cf.find((r: any) => r.month === key)
      return current?.incoming ?? 0
    })
    const monthOutgoing = computed(() => {
      const cf = summary.value?.cashFlow
      if (!cf || !cf.length) return 0
      const now = new Date()
      const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const current = cf.find((r: any) => r.month === key)
      return current?.outgoing ?? 0
    })

    const statCards = computed(() => [
      {
        title: 'Баланс',
        value: uah(summary.value?.balance ?? 0),
        icon: 'mdi-scale-balance',
        color: (summary.value?.balance ?? 0) >= 0 ? 'success' : 'error',
      },
      {
        title: 'Надходження (всього)',
        value: uah(summary.value?.totalIncoming ?? 0),
        icon: 'mdi-cash-plus',
        color: 'success',
      },
      {
        title: 'Витрати (всього)',
        value: uah(summary.value?.totalOutgoing ?? 0),
        icon: 'mdi-cash-minus',
        color: 'error',
      },
      {
        title: 'Надходження (місяць)',
        value: uah(monthIncoming.value),
        icon: 'mdi-arrow-down-bold-circle-outline',
        color: 'success',
      },
      {
        title: 'Витрати (місяць)',
        value: uah(monthOutgoing.value),
        icon: 'mdi-arrow-up-bold-circle-outline',
        color: 'error',
      },
      {
        title: 'Прострочені',
        value: summary.value?.overdueSchedules ?? 0,
        icon: 'mdi-alert-circle-outline',
        color: (summary.value?.overdueSchedules ?? 0) > 0 ? 'warning' : 'success',
      },
    ])

    // Cash flow chart
    const cashFlowOpts = computed(() => {
      const cf = summary.value?.cashFlow
      if (!cf || !cf.length) return null
      return {
        options: baseChartOpts({
          chart: { type: 'bar', stacked: false, background: 'transparent', toolbar: { show: false }, fontFamily: 'inherit' },
          colors: ['#4CAF50', '#F44336'],
          plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } },
          dataLabels: { enabled: false },
          xaxis: {
            categories: cf.map((r: any) => r.month),
            labels: { style: { colors: chartFg.value } },
          },
          yaxis: {
            labels: {
              style: { colors: chartFg.value },
              formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v)),
            },
          },
          tooltip: {
            theme: isDark.value ? 'dark' : 'light',
            y: { formatter: (v: number) => `${v.toLocaleString('uk-UA')} ₴` },
          },
          legend: { labels: { colors: chartFg.value } },
        }),
        series: [
          { name: 'Надходження', data: cf.map((r: any) => r.incoming) },
          { name: 'Витрати', data: cf.map((r: any) => r.outgoing) },
        ],
      }
    })

    // Overdue schedules
    const overdueSchedules = computed(() =>
      schedules.value.filter((s: any) => s.status === 'EXPECTED' && new Date(s.dueDate) < new Date()),
    )

    // Upcoming 30 days
    const upcomingSchedules = computed(() => {
      const now = new Date()
      const in30 = new Date()
      in30.setDate(in30.getDate() + 30)
      return schedules.value.filter(
        (s: any) => s.status === 'EXPECTED' && new Date(s.dueDate) >= now && new Date(s.dueDate) <= in30,
      )
    })

    const overdueHeaders = [
      { title: 'Обʼєкт', key: 'object.name', minWidth: 150 },
      { title: 'Клієнт', key: 'client.name', minWidth: 130 },
      { title: 'Сума', key: 'amount', align: 'end' as const, width: 130 },
      { title: 'Дата', key: 'dueDate', width: 120 },
      { title: 'Дії', key: 'actions', width: 80, sortable: false },
    ]

    const upcomingHeaders = [
      { title: 'Обʼєкт', key: 'object.name', minWidth: 150 },
      { title: 'Клієнт', key: 'client.name', minWidth: 130 },
      { title: 'Сума', key: 'amount', align: 'end' as const, width: 130 },
      { title: 'Дата', key: 'dueDate', width: 120 },
    ]

    const receivableHeaders = [
      { title: 'Клієнт', key: 'name', minWidth: 180 },
      { title: 'Виставлено', key: 'totalScheduled', align: 'end' as const, width: 130 },
      { title: 'Оплачено', key: 'totalPaid', align: 'end' as const, width: 130 },
      { title: 'Борг', key: 'debt', align: 'end' as const, width: 130 },
      { title: 'Прострочено', key: 'overdue', align: 'end' as const, width: 130 },
    ]

    const payableHeaders = [
      { title: 'Контрагент', key: 'name', minWidth: 180 },
      { title: 'Сума накладних', key: 'totalInvoiced', align: 'end' as const, width: 140 },
      { title: 'Оплачено', key: 'totalPaid', align: 'end' as const, width: 130 },
      { title: 'Борг', key: 'debt', align: 'end' as const, width: 130 },
    ]

    const profitHeaders = [
      { title: 'Обʼєкт', key: 'name', minWidth: 200 },
      { title: 'Дохід', key: 'income', align: 'end' as const, width: 130 },
      { title: 'Матеріали', key: 'materialCost', align: 'end' as const, width: 130 },
      { title: 'Зарплати', key: 'laborCost', align: 'end' as const, width: 130 },
      { title: 'Витрати', key: 'totalExpenses', align: 'end' as const, width: 130 },
      { title: 'Прибуток', key: 'profit', align: 'end' as const, width: 130 },
      { title: 'Маржа %', key: 'margin', align: 'end' as const, width: 100 },
    ]

    return () => (
      <div>
        <div class="text-h5 font-weight-bold mb-6">Фінансовий дашборд</div>

        {/* Stat cards — 2 rows of 3 */}
        <v-row class="mb-4">
          {statCards.value.map((card) => (
            <v-col key={card.title} cols={12} sm={6} md={4}>
              <v-card class="pa-4">
                <div class="d-flex align-center">
                  <v-icon size={36} color={card.color} icon={card.icon} class="mr-3" />
                  <div>
                    <div class="text-caption text-medium-emphasis">{card.title}</div>
                    <div class={`text-h6 font-weight-bold text-${card.color}`}>{card.value}</div>
                  </div>
                </div>
              </v-card>
            </v-col>
          ))}
        </v-row>

        {/* Cash Flow Chart with period selector */}
        <v-card class="mb-4">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" icon="mdi-chart-areaspline" />
            Cash Flow — рух коштів по місяцях
            <v-spacer />
            <v-btn-toggle v-model={cashFlowMonths.value} mandatory density="compact" variant="outlined" color="primary" class="gap-2">
              <v-btn value={3}>3 міс</v-btn>
              <v-btn value={6}>6 міс</v-btn>
              <v-btn value={12}>12 міс</v-btn>
            </v-btn-toggle>
          </v-card-title>
          <v-card-text>
            {cashFlowOpts.value && mounted.value
              ? (
                  <apexchart
                    type="bar"
                    height={320}
                    options={cashFlowOpts.value.options}
                    series={cashFlowOpts.value.series}
                  />
                )
              : <v-skeleton-loader type="image" height={320} />
            }
          </v-card-text>
        </v-card>

        {/* Overdue payments */}
        <v-card class="mb-4">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="error" icon="mdi-alert-circle-outline" />
            Прострочені платежі
            {overdueSchedules.value.length > 0 && (
              <v-chip class="ml-2" size="small" color="error" variant="tonal">
                {overdueSchedules.value.length}
              </v-chip>
            )}
          </v-card-title>
          {overdueSchedules.value.length === 0
            ? (
                <v-card-text>
                  <v-alert type="success" variant="tonal" density="compact">
                    Немає прострочених платежів
                  </v-alert>
                </v-card-text>
              )
            : (
                <v-data-table
                  headers={overdueHeaders}
                  items={overdueSchedules.value}
                  density="compact"
                  hover
                  items-per-page={10}
                >
                  {{
                    'item.object.name': ({ item }: any) => item.object?.name ?? '—',
                    'item.client.name': ({ item }: any) => item.client?.name ?? '—',
                    'item.amount': ({ item }: any) => (
                      <span class="text-error font-weight-bold">{uah(Number(item.amount))}</span>
                    ),
                    'item.dueDate': ({ item }: any) => new Date(item.dueDate).toLocaleDateString('uk-UA'),
                    'item.actions': ({ item }: any) => (
                      <v-btn size="small" variant="text" color="primary" to="/payments/schedule" icon="mdi-open-in-new" />
                    ),
                  }}
                </v-data-table>
              )
          }
        </v-card>

        {/* Upcoming payments (30 days) */}
        <v-card class="mb-4">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" icon="mdi-calendar-clock" />
            Найближчі платежі (30 днів)
            {upcomingSchedules.value.length > 0 && (
              <v-chip class="ml-2" size="small" color="info" variant="tonal">
                {upcomingSchedules.value.length}
              </v-chip>
            )}
          </v-card-title>
          {upcomingSchedules.value.length === 0
            ? (
                <v-card-text>
                  <v-alert type="info" variant="tonal" density="compact">
                    Немає запланованих платежів на найближчі 30 днів
                  </v-alert>
                </v-card-text>
              )
            : (
                <v-data-table
                  headers={upcomingHeaders}
                  items={upcomingSchedules.value}
                  density="compact"
                  hover
                  items-per-page={10}
                >
                  {{
                    'item.object.name': ({ item }: any) => item.object?.name ?? '—',
                    'item.client.name': ({ item }: any) => item.client?.name ?? '—',
                    'item.amount': ({ item }: any) => (
                      <span class="font-weight-bold">{uah(Number(item.amount))}</span>
                    ),
                    'item.dueDate': ({ item }: any) => new Date(item.dueDate).toLocaleDateString('uk-UA'),
                  }}
                </v-data-table>
              )
          }
        </v-card>

        {/* Receivables */}
        {(debts.value?.receivables?.length ?? 0) > 0 && (
          <v-card class="mb-4">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" icon="mdi-account-arrow-left" />
              Дебіторська заборгованість (нам винні клієнти)
              <v-spacer />
              <v-chip color="warning" variant="tonal" size="small">
                {uah(debts.value.totalReceivables)}
              </v-chip>
            </v-card-title>
            <v-data-table
              headers={receivableHeaders}
              items={debts.value.receivables}
              density="compact"
              hover
              items-per-page={10}
            >
              {{
                'item.totalScheduled': ({ item }: any) => uah(item.totalScheduled),
                'item.totalPaid': ({ item }: any) => <span class="text-success">{uah(item.totalPaid)}</span>,
                'item.debt': ({ item }: any) => (
                  <span class={`font-weight-bold ${item.debt > 0 ? 'text-warning' : ''}`}>{uah(item.debt)}</span>
                ),
                'item.overdue': ({ item }: any) => (
                  <span class={`${item.overdue > 0 ? 'text-error font-weight-bold' : ''}`}>{uah(item.overdue)}</span>
                ),
              }}
            </v-data-table>
          </v-card>
        )}

        {/* Payables */}
        {(debts.value?.payables?.length ?? 0) > 0 && (
          <v-card class="mb-4">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" icon="mdi-account-arrow-right" />
              Кредиторська заборгованість (ми винні контрагентам)
              <v-spacer />
              <v-chip color="error" variant="tonal" size="small">
                {uah(debts.value.totalPayables)}
              </v-chip>
            </v-card-title>
            <v-data-table
              headers={payableHeaders}
              items={debts.value.payables}
              density="compact"
              hover
              items-per-page={10}
            >
              {{
                'item.totalInvoiced': ({ item }: any) => uah(item.totalInvoiced),
                'item.totalPaid': ({ item }: any) => <span class="text-success">{uah(item.totalPaid)}</span>,
                'item.debt': ({ item }: any) => (
                  <span class={`font-weight-bold ${item.debt > 0 ? 'text-error' : ''}`}>{uah(item.debt)}</span>
                ),
              }}
            </v-data-table>
          </v-card>
        )}

        {/* Profitability by object */}
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" icon="mdi-chart-line" />
            Прибутковість по обʼєктах
          </v-card-title>
          <v-data-table
            headers={profitHeaders}
            items={profitability.value}
            density="compact"
            hover
            items-per-page={10}
          >
            {{
              'item.name': ({ item }: any) => (
                <nuxt-link to={`/reports/objects/${item.id}`} class="text-decoration-none">
                  {item.name}
                </nuxt-link>
              ),
              'item.income': ({ item }: any) => <span class="text-success">{uah(item.income)}</span>,
              'item.materialCost': ({ item }: any) => uah(item.materialCost),
              'item.laborCost': ({ item }: any) => uah(item.laborCost),
              'item.totalExpenses': ({ item }: any) => <span class="text-error">{uah(item.totalExpenses)}</span>,
              'item.profit': ({ item }: any) => (
                <span class={`font-weight-bold ${item.profit >= 0 ? 'text-success' : 'text-error'}`}>
                  {uah(item.profit)}
                </span>
              ),
              'item.margin': ({ item }: any) => (
                <span class={item.margin >= 0 ? 'text-success' : 'text-error'}>
                  {item.margin.toFixed(1)}%
                </span>
              ),
            }}
          </v-data-table>
        </v-card>
      </div>
    )
  },
})
