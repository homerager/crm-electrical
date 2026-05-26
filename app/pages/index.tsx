import { useTheme } from 'vuetify'

export default defineComponent({
  name: 'DashboardPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({
      title: 'Дашбоард',
    })

    const { isEmployee, isPrivileged, isAdmin } = useAuth()
    const vuetifyTheme = useTheme()
    const skipFull = () => isEmployee.value
    const skipFinance = () => !isAdmin.value

    const mounted = ref(false)
    onMounted(() => { mounted.value = true })

    const { data: invoicesData } = useFetch('/api/invoices', { skip: skipFull })
    const { data: movementsData } = useFetch('/api/movements', { skip: skipFull })
    const { data: objectsData } = useFetch('/api/objects', { skip: skipFull })
    const { data: warehousesData } = useFetch('/api/warehouses', { skip: skipFull })
    const { data: productsData } = useFetch('/api/products', { skip: skipFull })

    const { data: movByMonth } = useFetch('/api/reports/dashboard/movements-by-month', { skip: skipFull })
    const { data: objExpenses } = useFetch('/api/reports/dashboard/object-expenses-by-week', { skip: skipFull })
    const { data: empWorkload } = useFetch('/api/reports/dashboard/employee-workload', { skip: skipFull })
    const { data: finSummary } = useFetch('/api/reports/dashboard/finance-summary', { skip: skipFinance })

    const totalWarehouses = computed(() => (warehousesData.value as any)?.warehouses?.length ?? 0)
    const totalProducts = computed(() => (productsData.value as any)?.products?.length ?? 0)
    const totalObjects = computed(() => (objectsData.value as any)?.objects?.length ?? 0)
    const activeObjects = computed(
      () => (objectsData.value as any)?.objects?.filter((o: any) => o.status === 'ACTIVE').length ?? 0,
    )
    const totalInvoices = computed(() => (invoicesData.value as any)?.invoices?.length ?? 0)
    const totalMovements = computed(() => (movementsData.value as any)?.movements?.length ?? 0)

    const recentInvoices = computed(() =>
      ((invoicesData.value as any)?.invoices ?? []).slice(0, 5),
    )
    const recentMovements = computed(() =>
      ((movementsData.value as any)?.movements ?? []).slice(0, 5),
    )

    const statCards = computed(() => [
      { title: 'Склади', value: totalWarehouses.value, icon: 'mdi-warehouse', color: 'primary', to: '/warehouses' },
      { title: 'Товари', value: totalProducts.value, icon: 'mdi-package-variant-closed', color: 'success', to: '/products' },
      { title: 'Обʼєкти', value: `${activeObjects.value} / ${totalObjects.value}`, icon: 'mdi-office-building-outline', color: 'warning', to: '/objects', subtitle: 'активних / всього' },
      { title: 'Накладні', value: totalInvoices.value, icon: 'mdi-file-document-multiple', color: 'info', to: '/invoices' },
      { title: 'Переміщення', value: totalMovements.value, icon: 'mdi-swap-horizontal', color: 'secondary', to: '/movements' },
    ])

    const employeeCards = [
      { title: 'Проєкти', desc: 'Ваші проєкти та завдання', icon: 'mdi-folder-multiple-outline', color: 'primary', to: '/projects' },
      { title: 'Завдання', desc: 'Список і канбан завдань', icon: 'mdi-checkbox-marked-circle-outline', color: 'success', to: '/tasks' },
    ]

    const isDark = computed(() => vuetifyTheme.current.value.dark)
    const chartFg = computed(() => isDark.value ? '#E0E0E0' : '#424242')
    const chartGrid = computed(() => isDark.value ? '#333333' : '#E0E0E0')

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

    const movByMonthOpts = computed(() => {
      const d = movByMonth.value as any
      if (!d) return null
      return {
        options: baseChartOpts({
          chart: { type: 'area', background: 'transparent', toolbar: { show: false }, fontFamily: 'inherit' },
          colors: ['#2E7D32', '#D32F2F'],
          stroke: { curve: 'smooth', width: 2 },
          fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
          dataLabels: { enabled: false },
          xaxis: {
            categories: d.labels,
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
            y: { formatter: (v: number) => `${v.toLocaleString('uk-UA')} грн` },
          },
        }),
        series: [
          { name: 'Прихід', data: d.incoming },
          { name: 'Видаток', data: d.outgoing },
        ],
      }
    })

    const objExpensesOpts = computed(() => {
      const d = objExpenses.value as any
      if (!d) return null
      return {
        options: baseChartOpts({
          chart: { type: 'bar', stacked: true, background: 'transparent', toolbar: { show: false }, fontFamily: 'inherit' },
          colors: ['#1565C0', '#F57C00'],
          plotOptions: { bar: { columnWidth: '60%', borderRadius: 3 } },
          dataLabels: { enabled: false },
          xaxis: {
            categories: d.labels,
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
            y: { formatter: (v: number) => `${v.toLocaleString('uk-UA')} грн` },
          },
        }),
        series: [
          { name: 'Матеріали', data: d.material },
          { name: 'Праця', data: d.labor },
        ],
      }
    })

    const empWorkloadOpts = computed(() => {
      const d = empWorkload.value as any
      if (!d || !d.users.length) return null
      return {
        options: baseChartOpts({
          chart: { type: 'bar', background: 'transparent', toolbar: { show: false }, fontFamily: 'inherit' },
          colors: ['#42A5F5', '#66BB6A', '#EF5350'],
          plotOptions: { bar: { horizontal: true, barHeight: '65%', borderRadius: 3 } },
          dataLabels: { enabled: false },
          xaxis: {
            categories: d.users,
            labels: { style: { colors: chartFg.value } },
          },
          yaxis: {
            labels: { style: { colors: chartFg.value } },
          },
          tooltip: { theme: isDark.value ? 'dark' : 'light' },
        }),
        series: [
          { name: 'Годин', data: d.hours },
          { name: 'Активних задач', data: d.activeTasks },
          { name: 'Закритих задач', data: d.doneTasks },
        ],
      }
    })

    const fin = computed(() => finSummary.value as any ?? null)

    function uah(n: number) {
      return n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₴'
    }

    const finCashFlowOpts = computed(() => {
      const d = fin.value?.cashFlow
      if (!d || !d.length) return null
      return {
        options: baseChartOpts({
          chart: { type: 'area', background: 'transparent', toolbar: { show: false }, fontFamily: 'inherit' },
          colors: ['#4CAF50', '#F44336'],
          stroke: { curve: 'smooth', width: 2 },
          fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
          dataLabels: { enabled: false },
          xaxis: {
            categories: d.map((r: any) => r.month),
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
        }),
        series: [
          { name: 'Надходження', data: d.map((r: any) => r.incoming) },
          { name: 'Витрати', data: d.map((r: any) => r.outgoing) },
        ],
      }
    })

    const finStatCards = computed(() => {
      if (!fin.value) return []
      return [
        {
          title: 'Баланс',
          value: uah(fin.value.balance),
          icon: 'mdi-scale-balance',
          color: fin.value.balance >= 0 ? 'success' : 'error',
        },
        {
          title: 'Надходження (місяць)',
          value: uah(fin.value.monthIncoming),
          icon: 'mdi-arrow-down-bold-circle-outline',
          color: 'success',
        },
        {
          title: 'Витрати (місяць)',
          value: uah(fin.value.monthOutgoing),
          icon: 'mdi-arrow-up-bold-circle-outline',
          color: 'error',
        },
        {
          title: 'Прострочені',
          value: fin.value.overdueCount,
          icon: 'mdi-alert-circle-outline',
          color: fin.value.overdueCount > 0 ? 'warning' : 'success',
          badge: fin.value.overdueCount > 0 ? fin.value.overdueCount : null,
        },
      ]
    })

    function renderChart(
      title: string,
      icon: string,
      opts: { options: Record<string, any>; series: any[] } | null,
      type: string,
      height: number,
    ) {
      return (
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" icon={icon} />
            {title}
          </v-card-title>
          <v-card-text>
            {opts && mounted.value
              ? (
                  <apexchart
                    type={type}
                    height={height}
                    options={opts.options}
                    series={opts.series}
                  />
                )
              : <v-skeleton-loader type="image" height={height} />
            }
          </v-card-text>
        </v-card>
      )
    }

    return () => (
      <div>
        <div class="text-h5 font-weight-bold mb-6">Дашборд</div>

        {isEmployee.value
          ? (
              <v-row>
                {employeeCards.map((c) => (
                  <v-col key={c.to} cols={12} sm={6}>
                    <v-card to={c.to} hover variant="outlined">
                      <v-card-text class="pa-6">
                        <v-icon size={48} color={c.color} icon={c.icon} class="mb-4" />
                        <div class="text-h6 font-weight-bold mb-2">{c.title}</div>
                        <div class="text-body-2 text-medium-emphasis">{c.desc}</div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                ))}
              </v-row>
            )
          : (
              <>
                <v-row class="mb-4">
                  {statCards.value.map((card) => (
                    <v-col key={card.title} cols={12} sm={6} md={4} lg={2}>
                      <v-card to={card.to} hover>
                        <v-card-text class="text-center pa-4">
                          <v-icon size={40} color={card.color} icon={card.icon} class="mb-2" />
                          <div class="text-h5 font-weight-bold">{card.value}</div>
                          <div class="text-body-2 text-medium-emphasis">{card.title}</div>
                          {card.subtitle && <div class="text-caption text-medium-emphasis">{card.subtitle}</div>}
                        </v-card-text>
                      </v-card>
                    </v-col>
                  ))}
                </v-row>

                <v-row class="mb-4">
                  <v-col cols={12}>
                    {renderChart(
                      'Динаміка руху товарів по місяцях',
                      'mdi-chart-line',
                      movByMonthOpts.value,
                      'area',
                      320,
                    )}
                  </v-col>
                </v-row>

                <v-row class="mb-4">
                  <v-col cols={12} md={7}>
                    {renderChart(
                      'Витрати на обʼєкти по тижнях',
                      'mdi-chart-bar',
                      objExpensesOpts.value,
                      'bar',
                      320,
                    )}
                  </v-col>
                  <v-col cols={12} md={5}>
                    {renderChart(
                      'Завантаженість працівників',
                      'mdi-account-group',
                      empWorkloadOpts.value,
                      'bar',
                      320,
                    )}
                  </v-col>
                </v-row>

                <v-row>
                  <v-col cols={12} md={6}>
                    <v-card>
                      <v-card-title class="d-flex align-center">
                        <v-icon class="mr-2" icon="mdi-file-document-multiple" />
                        Останні накладні
                        <v-spacer />
                        <v-btn variant="text" size="small" to="/invoices">Всі</v-btn>
                      </v-card-title>
                      <v-list lines="two">
                        {recentInvoices.value.length === 0 && (
                          <v-list-item title="Немає накладних" />
                        )}
                        {recentInvoices.value.map((inv: any) => (
                          <v-list-item
                            key={inv.id}
                            title={`№${inv.number} — ${inv.warehouse?.name}`}
                            subtitle={new Date(inv.date).toLocaleDateString('uk-UA')}
                            to={`/invoices/${inv.id}`}
                          >
                            {{
                              prepend: () => (
                                <v-chip
                                  size="small"
                                  color={inv.type === 'INCOMING' ? 'success' : 'error'}
                                  variant="tonal"
                                  class="mr-2"
                                >
                                  {inv.type === 'INCOMING' ? 'Прихід' : 'Видаток'}
                                </v-chip>
                              ),
                            }}
                          </v-list-item>
                        ))}
                      </v-list>
                    </v-card>
                  </v-col>

                  <v-col cols={12} md={6}>
                    <v-card>
                      <v-card-title class="d-flex align-center">
                        <v-icon class="mr-2" icon="mdi-swap-horizontal" />
                        Останні переміщення
                        <v-spacer />
                        <v-btn variant="text" size="small" to="/movements">Всі</v-btn>
                      </v-card-title>
                      <v-list lines="two">
                        {recentMovements.value.length === 0 && (
                          <v-list-item title="Немає переміщень" />
                        )}
                        {recentMovements.value.map((mov: any) => (
                          <v-list-item
                            key={mov.id}
                            title={
                              mov.type === 'WAREHOUSE_TO_WAREHOUSE'
                                ? `${mov.fromWarehouse?.name} → ${mov.toWarehouse?.name}`
                                : `${mov.fromWarehouse?.name} → ${mov.object?.name}`
                            }
                            subtitle={new Date(mov.date).toLocaleDateString('uk-UA')}
                            to={`/movements/${mov.id}`}
                          >
                            {{
                              prepend: () => (
                                <v-icon
                                  icon={mov.type === 'WAREHOUSE_TO_WAREHOUSE' ? 'mdi-swap-horizontal' : 'mdi-truck-delivery'}
                                  color={mov.type === 'WAREHOUSE_TO_WAREHOUSE' ? 'primary' : 'warning'}
                                />
                              ),
                            }}
                          </v-list-item>
                        ))}
                      </v-list>
                    </v-card>
                  </v-col>
                </v-row>

                {isAdmin.value && fin.value && (
                  <>
                    <v-divider class="my-6" />
                    <div class="d-flex align-center mb-4">
                      <v-icon class="mr-2" icon="mdi-finance" color="primary" />
                      <span class="text-h6 font-weight-bold">Фінанси</span>
                      <v-spacer />
                      <v-btn variant="tonal" color="primary" size="small" to="/finance-dashboard" prepend-icon="mdi-arrow-right">
                        Детальніше
                      </v-btn>
                    </div>

                    <v-row class="mb-4">
                      {finStatCards.value.map((card) => (
                        <v-col key={card.title} cols={12} sm={6} md={3}>
                          <v-card>
                            <v-card-text class="text-center pa-4">
                              <v-badge
                                content={card.badge}
                                color="error"
                                floating
                                dot={false}
                                model-value={!!card.badge}
                              >
                                <v-icon size={40} color={card.color} icon={card.icon} class="mb-2" />
                              </v-badge>
                              <div class={`text-h6 font-weight-bold text-${card.color}`}>{card.value}</div>
                              <div class="text-body-2 text-medium-emphasis">{card.title}</div>
                            </v-card-text>
                          </v-card>
                        </v-col>
                      ))}
                    </v-row>

                    {fin.value.overdueCount > 0 && (
                      <v-alert type="warning" variant="tonal" class="mb-4" prominent>
                        {{
                          default: () => (
                            <div class="d-flex align-center justify-space-between flex-wrap ga-2">
                              <span>
                                <strong>{fin.value.overdueCount}</strong> прострочених платежів на суму{' '}
                                <strong>{uah(fin.value.overdueAmount)}</strong>
                              </span>
                              <v-btn variant="outlined" size="small" color="warning" to="/payments/schedule">
                                Переглянути
                              </v-btn>
                            </div>
                          ),
                        }}
                      </v-alert>
                    )}

                    <v-row class="mb-4">
                      <v-col cols={12} md={7}>
                        {renderChart(
                          'Cash Flow (6 місяців)',
                          'mdi-chart-areaspline',
                          finCashFlowOpts.value,
                          'area',
                          280,
                        )}
                      </v-col>
                      <v-col cols={12} md={5}>
                        <v-card style="height: 100%">
                          <v-card-title class="d-flex align-center">
                            <v-icon class="mr-2" icon="mdi-calendar-clock" />
                            Найближчі платежі
                            <v-spacer />
                            <v-btn variant="text" size="small" to="/payments/schedule">Всі</v-btn>
                          </v-card-title>
                          <v-list lines="two" density="compact">
                            {(fin.value.upcomingPayments?.length ?? 0) === 0 && (
                              <v-list-item title="Немає запланованих платежів" />
                            )}
                            {(fin.value.upcomingPayments ?? []).map((p: any) => (
                              <v-list-item
                                key={p.id}
                                title={`${p.objectName} — ${p.clientName}`}
                                subtitle={new Date(p.dueDate).toLocaleDateString('uk-UA')}
                              >
                                {{
                                  append: () => (
                                    <span class="text-body-2 font-weight-bold">{uah(p.amount)}</span>
                                  ),
                                }}
                              </v-list-item>
                            ))}
                          </v-list>
                        </v-card>
                      </v-col>
                    </v-row>

                    <v-row>
                      <v-col cols={12} sm={6}>
                        <v-card>
                          <v-card-text class="pa-4">
                            <div class="text-caption text-medium-emphasis">Дебіторська заборгованість</div>
                            <div class={`text-h6 font-weight-bold ${fin.value.totalReceivables > 0 ? 'text-warning' : 'text-success'}`}>
                              {uah(fin.value.totalReceivables)}
                            </div>
                            <div class="text-caption text-medium-emphasis">Нам винні клієнти</div>
                          </v-card-text>
                        </v-card>
                      </v-col>
                      <v-col cols={12} sm={6}>
                        <v-card>
                          <v-card-text class="pa-4">
                            <div class="text-caption text-medium-emphasis">Кредиторська заборгованість</div>
                            <div class={`text-h6 font-weight-bold ${fin.value.totalPayables > 0 ? 'text-error' : 'text-success'}`}>
                              {uah(fin.value.totalPayables)}
                            </div>
                            <div class="text-caption text-medium-emphasis">Ми винні контрагентам</div>
                          </v-card-text>
                        </v-card>
                      </v-col>
                    </v-row>
                  </>
                )}
              </>
            )}
      </div>
    )
  },
})
