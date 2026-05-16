import { useTheme } from 'vuetify'

export default defineComponent({
  name: 'ReportsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({
      title: 'Репорти'
    })

    const { data, pending } = useFetch('/api/reports/stock')
    const { data: objectsData } = useFetch('/api/objects')
    const { data: summaryData } = useFetch('/api/payments/summary', { query: { months: 12 } })
    const { data: debtsData } = useFetch('/api/payments/debts')
    const { data: profitData } = useFetch('/api/reports/object-profitability')

    const warehouses = computed(() => (data.value as any)?.warehouses ?? [])
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])
    const summary = computed(() => summaryData.value as any ?? {})
    const debts = computed(() => debtsData.value as any ?? {})
    const profitability = computed(() => (profitData.value as any)?.objects ?? [])

    const selectedWarehouse = ref<string | null>(null)
    const activeTab = ref('stock')
    const mounted = ref(false)
    onMounted(() => { mounted.value = true })

    const theme = useTheme()
    const isDark = computed(() => theme.global.current.value.dark)
    const chartFg = computed(() => isDark.value ? '#BDBDBD' : '#616161')
    const chartGrid = computed(() => isDark.value ? '#333333' : '#E0E0E0')

    const filteredWarehouses = computed(() => {
      if (!selectedWarehouse.value) return warehouses.value
      return warehouses.value.filter((w: any) => w.id === selectedWarehouse.value)
    })

    function uah(n: number) {
      return n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₴'
    }

    const cashFlowOpts = computed(() => {
      const cf = summary.value?.cashFlow
      if (!cf || !cf.length) return null
      const months = cf.map((r: any) => r.month)
      const incoming = cf.map((r: any) => r.incoming)
      const outgoing = cf.map((r: any) => r.outgoing)
      return {
        options: {
          chart: { type: 'bar', stacked: false, background: 'transparent', toolbar: { show: false }, fontFamily: 'inherit' },
          theme: { mode: isDark.value ? 'dark' as const : 'light' as const },
          colors: ['#4CAF50', '#F44336'],
          plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } },
          dataLabels: { enabled: false },
          grid: { borderColor: chartGrid.value },
          xaxis: { categories: months, labels: { style: { colors: chartFg.value } } },
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
        },
        series: [
          { name: 'Надходження', data: incoming },
          { name: 'Витрати', data: outgoing },
        ],
      }
    })

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
        <div class="text-h5 font-weight-bold mb-4">Репорти</div>

        <v-tabs v-model={activeTab.value} class="mb-4" show-arrows>
          <v-tab value="stock" prepend-icon="mdi-warehouse">Залишки на складах</v-tab>
          <v-tab value="objects" prepend-icon="mdi-office-building-outline">По обʼєктах</v-tab>
          <v-tab value="finance" prepend-icon="mdi-cash-multiple">Фінанси</v-tab>
        </v-tabs>

        <v-window v-model={activeTab.value}>
          <v-window-item value="stock">
            <v-row class="mb-4">
              <v-col cols={12} md={4}>
                <v-select
                  v-model={selectedWarehouse.value}
                  label="Фільтр по складу"
                  items={[{ name: 'Всі склади', id: null }, ...warehouses.value]}
                  item-title="name"
                  item-value="id"
                  clearable
                  hide-details
                />
              </v-col>
            </v-row>

            {filteredWarehouses.value.map((warehouse: any) => (
              <v-card key={warehouse.id} class="mb-4">
                <v-card-title class="d-flex align-center">
                  <v-icon class="mr-2" icon="mdi-warehouse" />
                  {warehouse.name}
                  <v-chip class="ml-3" size="small" variant="tonal" color="primary">
                    {warehouse.stock.length} позицій
                  </v-chip>
                </v-card-title>
                {warehouse.stock.length === 0 ? (
                  <v-card-text>
                    <v-alert type="info" variant="tonal" density="compact">Склад порожній</v-alert>
                  </v-card-text>
                ) : (
                  <v-table density="compact">
                    <thead>
                      <tr>
                        <th>Товар</th>
                        <th>Артикул</th>
                        <th class="text-right">Кількість</th>
                        <th class="text-center">Од.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {warehouse.stock.map((s: any) => (
                        <tr key={s.id}>
                          <td>{s.product.name}</td>
                          <td class="text-medium-emphasis">{s.product.sku || '—'}</td>
                          <td class={`text-right font-weight-medium ${Number(s.quantity) < 5 ? 'text-error' : ''}`}>
                            {Number(s.quantity).toLocaleString('uk-UA')}
                          </td>
                          <td class="text-center">{s.product.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </v-table>
                )}
              </v-card>
            ))}

            {pending.value && <v-progress-linear indeterminate color="primary" />}
          </v-window-item>

          <v-window-item value="objects">
            <v-row>
              {objects.value.map((obj: any) => (
                <v-col key={obj.id} cols={12} md={6} lg={4}>
                  <v-card>
                    <v-card-title class="d-flex align-center">
                      <v-icon class="mr-2" icon="mdi-office-building-outline" />
                      {obj.name}
                    </v-card-title>
                    <v-card-subtitle>{obj.address}</v-card-subtitle>
                    <v-card-actions>
                      <v-btn variant="tonal" color="primary" prepend-icon="mdi-chart-bar" to={`/reports/objects/${obj.id}`} block>
                        Переглянути репорт
                      </v-btn>
                    </v-card-actions>
                  </v-card>
                </v-col>
              ))}
            </v-row>
          </v-window-item>

          <v-window-item value="finance">
            {/* Summary cards */}
            <v-row class="mb-4">
              <v-col cols={12} sm={6} md={3}>
                <v-card class="pa-4">
                  <div class="text-caption text-medium-emphasis">Загальні надходження</div>
                  <div class="text-h6 font-weight-bold text-success">{uah(summary.value?.totalIncoming ?? 0)}</div>
                </v-card>
              </v-col>
              <v-col cols={12} sm={6} md={3}>
                <v-card class="pa-4">
                  <div class="text-caption text-medium-emphasis">Загальні витрати</div>
                  <div class="text-h6 font-weight-bold text-error">{uah(summary.value?.totalOutgoing ?? 0)}</div>
                </v-card>
              </v-col>
              <v-col cols={12} sm={6} md={3}>
                <v-card class="pa-4">
                  <div class="text-caption text-medium-emphasis">Дебіторська заборг.</div>
                  <div class={`text-h6 font-weight-bold ${(debts.value?.totalReceivables ?? 0) > 0 ? 'text-warning' : 'text-success'}`}>
                    {uah(debts.value?.totalReceivables ?? 0)}
                  </div>
                </v-card>
              </v-col>
              <v-col cols={12} sm={6} md={3}>
                <v-card class="pa-4">
                  <div class="text-caption text-medium-emphasis">Кредиторська заборг.</div>
                  <div class={`text-h6 font-weight-bold ${(debts.value?.totalPayables ?? 0) > 0 ? 'text-warning' : 'text-success'}`}>
                    {uah(debts.value?.totalPayables ?? 0)}
                  </div>
                </v-card>
              </v-col>
            </v-row>

            {/* Cash Flow Chart */}
            <v-card class="mb-4">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" icon="mdi-chart-areaspline" />
                Cash Flow — рух коштів по місяцях
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

            {/* Debts: Receivables */}
            {(debts.value?.receivables?.length ?? 0) > 0 && (
              <v-card class="mb-4">
                <v-card-title class="d-flex align-center">
                  <v-icon class="mr-2" icon="mdi-account-arrow-left" />
                  Дебіторська заборгованість (нам винні клієнти)
                </v-card-title>
                <v-table density="compact">
                  <thead>
                    <tr>
                      <th>Клієнт</th>
                      <th class="text-right">Виставлено</th>
                      <th class="text-right">Оплачено</th>
                      <th class="text-right">Борг</th>
                      <th class="text-right">Прострочено</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debts.value.receivables.map((r: any) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td class="text-right">{uah(r.totalScheduled)}</td>
                        <td class="text-right text-success">{uah(r.totalPaid)}</td>
                        <td class={`text-right font-weight-bold ${r.debt > 0 ? 'text-warning' : ''}`}>{uah(r.debt)}</td>
                        <td class={`text-right ${r.overdue > 0 ? 'text-error font-weight-bold' : ''}`}>{uah(r.overdue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </v-table>
              </v-card>
            )}

            {/* Debts: Payables */}
            {(debts.value?.payables?.length ?? 0) > 0 && (
              <v-card class="mb-4">
                <v-card-title class="d-flex align-center">
                  <v-icon class="mr-2" icon="mdi-account-arrow-right" />
                  Кредиторська заборгованість (ми винні контрагентам)
                </v-card-title>
                <v-table density="compact">
                  <thead>
                    <tr>
                      <th>Контрагент</th>
                      <th class="text-right">Сума накладних</th>
                      <th class="text-right">Оплачено</th>
                      <th class="text-right">Борг</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debts.value.payables.map((r: any) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td class="text-right">{uah(r.totalInvoiced)}</td>
                        <td class="text-right text-success">{uah(r.totalPaid)}</td>
                        <td class={`text-right font-weight-bold ${r.debt > 0 ? 'text-error' : ''}`}>{uah(r.debt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </v-table>
              </v-card>
            )}

            {/* Profitability by object */}
            <v-card>
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" icon="mdi-chart-line" />
                Прибутковість по обʼєктах
              </v-card-title>
              <v-data-table headers={profitHeaders} items={profitability.value} density="compact" hover>
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
          </v-window-item>
        </v-window>
      </div>
    )
  },
})
