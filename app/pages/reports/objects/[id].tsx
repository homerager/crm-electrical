import ObjectReservationOps from '../../../components/ObjectReservationOps'
import ObjectStockOps from '../../../components/ObjectStockOps'
import AuditLogPanel from '../../../components/AuditLogPanel'

export default defineComponent({
  name: 'ObjectReportPage',
  setup() {
    definePageMeta({ middleware: ['auth'], permission: 'reports.view' })

    const route = useRoute()
    const id = route.params.id as string
    const { data, pending, refresh } = useFetch(`/api/reports/objects/${id}`)
    const { data: payStatusData } = useFetch('/api/payments/object-status', { query: { objectId: id } })

    const report = computed(() => data.value as any)
    const object = computed(() => report.value?.object)

    useHead({
      title: computed(() => object.value ? `Репорт: ${object.value.name}` : 'Репорт обʼєкта')
    })
    const summary = computed(() => report.value?.summary ?? [])
    const movements = computed(() => report.value?.movements ?? [])
    const laborByUser = computed(() => report.value?.laborByUser ?? [])
    const summaryTotalAmount = computed(() => Number(report.value?.summaryTotalAmount) || 0)
    const summaryHasMissingPrice = computed(() => report.value?.summaryHasMissingPrice === true)
    const laborTotalHours = computed(() => Number(report.value?.laborTotalHours) || 0)
    const laborTotalAmount = computed(() => Number(report.value?.laborTotalAmount) || 0)
    const laborHasMissingRate = computed(() => report.value?.laborHasMissingRate === true)
    const laborLogCount = computed(() => Number(report.value?.laborLogCount) || 0)

    const payStatus = computed(() => payStatusData.value as any)

    const budget = computed(() => report.value?.budget != null ? Number(report.value.budget) : null)
    const totalExpenses = computed(() => Number(report.value?.totalExpenses) || 0)
    const budgetRemaining = computed(() => report.value?.budgetRemaining != null ? Number(report.value.budgetRemaining) : null)
    const budgetUsedPercent = computed(() => report.value?.budgetUsedPercent != null ? Number(report.value.budgetUsedPercent) : null)

    const stockOnSite = computed(() => report.value?.stockOnSite ?? [])
    const warehouseReservations = computed(
      () => (report.value?.warehouseReservations ?? []).filter((r: any) => Number(r.quantity) > 0),
    )
    const consumedSummary = computed(() => report.value?.consumedSummary ?? [])
    const consumedTotalAmount = computed(() => Number(report.value?.consumedTotalAmount) || 0)
    const consumedHasMissingPrice = computed(() => report.value?.consumedHasMissingPrice === true)
    const writeOffMovements = computed(() => report.value?.writeOffMovements ?? [])
    const returnMovements = computed(() => report.value?.returnMovements ?? [])

    const uah = (n: number) =>
      `₴${n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    const activeTab = ref('overview')

    const summaryHeaders = [
      { title: 'Товар', key: 'product.name' },
      { title: 'Артикул', key: 'product.sku', width: 120 },
      { title: 'Постачальник', key: 'contractor', sortable: false, width: 160 },
      { title: 'Загальна кількість', key: 'totalQuantity', align: 'end' as const, width: 160 },
      { title: 'Одиниця', key: 'unit', align: 'center' as const, width: 100 },
      {
        title: 'Ціна, ₴',
        key: 'pricePerUnit',
        align: 'end' as const,
        width: 120,
        sortable: false,
      },
      { title: 'Сума, ₴', key: 'totalAmount', align: 'end' as const, width: 130, sortable: false },
      { title: 'Постачальники', key: 'supplyHistory', sortable: false },
      { title: 'Накладні', key: 'invoices', sortable: false },
    ]

    const movementHeaders = [
      { title: 'Дата', key: 'date', width: 120 },
      { title: 'Склад', key: 'fromWarehouse.name', width: 160 },
      { title: 'Позиції', key: 'itemsPreview', sortable: false, minWidth: 220 },
      { title: 'Автор', key: 'createdBy.name', width: 140 },
      { title: 'Примітки', key: 'notes' },
      { title: '', key: 'link', sortable: false, width: 60 },
    ]

    const stockOnSiteHeaders = [
      { title: 'Товар', key: 'product.name' },
      { title: 'Артикул', key: 'product.sku', width: 120 },
      { title: 'Постачальник', key: 'contractor', sortable: false, width: 160 },
      { title: 'Ціна, ₴', key: 'pricePerUnit', align: 'end' as const, width: 120, sortable: false },
      { title: 'Залишок', key: 'quantity', align: 'end' as const, width: 140 },
      { title: 'Одиниця', key: 'product.unit', align: 'center' as const, width: 100 },
      { title: 'Постачальники', key: 'supplyHistory', sortable: false },
      { title: 'Накладні', key: 'invoices', sortable: false },
    ]

    const reservationHeaders = [
      { title: 'Склад', key: 'warehouse.name', width: 180 },
      { title: 'Товар', key: 'product.name' },
      { title: 'Артикул', key: 'product.sku', width: 120 },
      { title: 'Зарезервовано', key: 'quantity', align: 'end' as const, width: 140 },
      { title: 'Одиниця', key: 'product.unit', align: 'center' as const, width: 100 },
      { title: 'Постачальники', key: 'supplyHistory', sortable: false },
      { title: 'Накладні', key: 'invoices', sortable: false },
    ]

    const consumedHeaders = [
      { title: 'Товар', key: 'product.name', minWidth: 160 },
      { title: 'Артикул', key: 'product.sku', width: 112 },
      { title: 'Постачальник', key: 'contractor', sortable: false, width: 150 },
      { title: 'Використано', key: 'totalQuantity', align: 'end' as const, width: 96 },
      { title: 'Одиниця', key: 'unit', align: 'center' as const, width: 88 },
      {
        title: 'Ціна за одиницю, ₴',
        key: 'pricePerUnit',
        align: 'end' as const,
        width: 138,
        sortable: false,
      },
      { title: 'Сума, ₴', key: 'totalAmount', align: 'end' as const, width: 118, sortable: false },
      { title: 'Постачальники', key: 'supplyHistory', sortable: false },
      { title: 'Накладні', key: 'invoices', sortable: false },
    ]

    const writeOffLogHeaders = [
      { title: 'Дата', key: 'date', width: 120 },
      { title: 'Автор', key: 'createdBy.name', width: 140 },
      { title: 'Позицій', key: 'items', sortable: false, width: 100 },
      { title: 'Примітки', key: 'notes' },
      { title: '', key: 'link', sortable: false, width: 60 },
    ]

    const returnLogHeaders = [
      { title: 'Дата', key: 'date', width: 120 },
      { title: 'Склад', key: 'toWarehouse.name', width: 160 },
      { title: 'Позиції', key: 'itemsPreview', sortable: false, minWidth: 220 },
      { title: 'Автор', key: 'createdBy.name', width: 140 },
      { title: 'Примітки', key: 'notes' },
      { title: '', key: 'link', sortable: false, width: 60 },
    ]

    const laborHeaders = [
      { title: 'Працівник', key: 'userName' },
      { title: 'Години', key: 'totalHours', align: 'end' as const, width: 120, sortable: false },
      { title: 'Ставка, ₴/год', key: 'hourlyRate', align: 'end' as const, width: 130, sortable: false },
      { title: 'Сума, ₴', key: 'totalAmount', align: 'end' as const, width: 130, sortable: false },
    ]

    const hoursStr = (h: number) =>
      h.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

    function renderLotContractor(item: any) {
      if (!item.contractor?.name) return <span class="text-medium-emphasis">—</span>
      return (
        <v-chip size="x-small" variant="tonal" color="secondary">{item.contractor.name}</v-chip>
      )
    }

    function renderLotPrice(item: any) {
      const price = Number(item.pricePerUnit)
      if (!Number.isFinite(price) || price <= 0) return <span class="text-medium-emphasis">—</span>
      return <span>{uah(price)}</span>
    }

    function renderContractors(item: any) {
      const contractors = [
        ...new Map<string, string>(
          (item.supplyHistory ?? [])
            .filter((s: any) => s.contractor)
            .map((s: any) => [s.contractor.id, s.contractor.name] as [string, string]),
        ).values(),
      ]
      if (!contractors.length) return <span class="text-medium-emphasis">—</span>
      const visible = contractors.slice(0, 2)
      const rest = contractors.slice(2)
      return (
        <div class="d-flex flex-wrap gap-1 align-center">
          {visible.map((name, i) => (
            <v-chip key={i} size="x-small" variant="tonal" color="secondary">{name}</v-chip>
          ))}
          {rest.length > 0 && (
            <v-tooltip>
              {{
                activator: ({ props }: any) => (
                  <v-chip {...props} size="x-small" variant="tonal">+{rest.length}</v-chip>
                ),
                default: () => (
                  <div>{rest.map((name, i) => <div key={i}>{name}</div>)}</div>
                ),
              }}
            </v-tooltip>
          )}
        </div>
      )
    }

    function renderInvoices(item: any) {
      const invoices = [
        ...new Map(
          (item.supplyHistory ?? []).map((s: any) => [s.invoice.id, s.invoice]),
        ).values(),
      ] as any[]
      if (!invoices.length) return <span class="text-medium-emphasis">—</span>
      const visible = invoices.slice(0, 2)
      const rest = invoices.slice(2)
      return (
        <div class="d-flex flex-wrap gap-1 align-center">
          {visible.map((inv: any) => (
            <v-chip key={inv.id} size="x-small" variant="outlined" to={`/invoices/${inv.id}`}>
              {inv.number} ({new Date(inv.date).toLocaleDateString('uk-UA')})
            </v-chip>
          ))}
          {rest.length > 0 && (
            <v-tooltip>
              {{
                activator: ({ props }: any) => (
                  <v-chip {...props} size="x-small" variant="tonal">+{rest.length}</v-chip>
                ),
                default: () => (
                  <div>
                    {rest.map((inv: any) => (
                      <div key={inv.id}>
                        {inv.number} ({new Date(inv.date).toLocaleDateString('uk-UA')})
                      </div>
                    ))}
                  </div>
                ),
              }}
            </v-tooltip>
          )}
        </div>
      )
    }

    function printReport() {
      window.print()
    }

    function movementLineItemsCell(items: any[] | undefined) {
      const list = items ?? []
      if (!list.length) return <span class="text-medium-emphasis">—</span>
      return (
        <div class="d-flex flex-column gap-1">
          {list.map((it: any, i: number) => (
            <div key={i} class="text-body-2">
              <span class="font-weight-medium">{it.product?.name ?? '—'}</span>
              {' — '}
              <span>{Number(it.quantity).toLocaleString('uk-UA')}</span>
              {it.product?.unit ? <> {it.product.unit}</> : null}
            </div>
          ))}
        </div>
      )
    }

    const STATUS_LABELS: Record<string, string> = {
      ACTIVE: 'Активний',
      COMPLETED: 'Завершений',
      SUSPENDED: 'Призупинений',
    }

    const STATUS_COLORS: Record<string, string> = {
      ACTIVE: 'success',
      COMPLETED: 'primary',
      SUSPENDED: 'warning',
    }

    const writeOffLogOpen = ref(false)

    function renderSummaryStats() {
      return (
        <v-row class="mb-2">
          <v-col cols={12} sm={6} md={3}>
            <v-card variant="outlined" class="pa-3">
              <div class="d-flex align-center mb-1">
                <v-icon icon="mdi-package-variant-closed" size="small" class="mr-2 text-medium-emphasis" />
                <span class="text-body-2 text-medium-emphasis">Матеріали відпущено</span>
              </div>
              <div class="text-h6 font-weight-bold">{uah(summaryTotalAmount.value)}</div>
              <div class="text-caption text-medium-emphasis">{summary.value.length} позицій</div>
            </v-card>
          </v-col>
          <v-col cols={12} sm={6} md={3}>
            <v-card variant="outlined" class="pa-3">
              <div class="d-flex align-center mb-1">
                <v-icon icon="mdi-check-circle-outline" size="small" class="mr-2 text-medium-emphasis" />
                <span class="text-body-2 text-medium-emphasis">Використано (факт)</span>
              </div>
              <div class="text-h6 font-weight-bold">
                {consumedSummary.value.length > 0 ? uah(consumedTotalAmount.value) : '0 позицій'}
              </div>
              <div class="text-caption text-medium-emphasis">
                {consumedSummary.value.length > 0
                  ? `${consumedSummary.value.length} позицій`
                  : 'не розпочато'}
              </div>
            </v-card>
          </v-col>
          <v-col cols={12} sm={6} md={3}>
            <v-card variant="outlined" class="pa-3">
              <div class="d-flex align-center mb-1">
                <v-icon icon="mdi-account-clock-outline" size="small" class="mr-2 text-medium-emphasis" />
                <span class="text-body-2 text-medium-emphasis">Праця</span>
              </div>
              <div class="text-h6 font-weight-bold">{uah(laborTotalAmount.value)}</div>
              <div class="text-caption text-medium-emphasis">
                {hoursStr(laborTotalHours.value)} год · {laborByUser.value.length} працівників
              </div>
            </v-card>
          </v-col>
          <v-col cols={12} sm={6} md={3}>
            <v-card variant="outlined" class="pa-3">
              <div class="d-flex align-center mb-1">
                <v-icon icon="mdi-lock-outline" size="small" class="mr-2 text-medium-emphasis" />
                <span class="text-body-2 text-medium-emphasis">Резерв на складах</span>
              </div>
              <div class="text-h6 font-weight-bold">{warehouseReservations.value.length} позицій</div>
              <div class="text-caption text-medium-emphasis">
                {warehouseReservations.value.length > 0 ? 'активні резерви' : 'немає активних'}
              </div>
            </v-card>
          </v-col>
        </v-row>
      )
    }

    function renderOverviewTab() {
      return (
        <>
          <v-row class="mb-4">
            <v-col cols={12} md={12}>
              <v-card variant="outlined" class="fill-height">
                <v-card-title class="d-flex align-center flex-wrap">
                  <v-icon class="mr-2" icon="mdi-lock-outline" size="small" />
                  Резерв на складах
                  <v-spacer />
                  <ObjectReservationOps
                    objectId={id}
                    reservationRows={warehouseReservations.value}
                    onSuccess={() => refresh()}
                  />
                </v-card-title>
                {warehouseReservations.value.length === 0 ? (
                  <v-card-text class="d-flex flex-column align-center justify-center py-8">
                    <v-icon icon="mdi-package-variant-remove" size="48" class="text-medium-emphasis mb-2" />
                    <span class="text-body-2 text-medium-emphasis">Немає активних резервів</span>
                  </v-card-text>
                ) : (
                  <v-data-table
                    headers={reservationHeaders}
                    items={warehouseReservations.value}
                    hide-default-footer
                    items-per-page={-1}
                    density="compact"
                  >
                    {{
                      'item.product.sku': ({ item }: any) => (
                        <span class="whitespace-nowrap">{item.product?.sku || '—'}</span>
                      ),
                      'item.quantity': ({ item }: any) => (
                        <strong>{Number(item.quantity).toLocaleString('uk-UA')}</strong>
                      ),
                      'item.supplyHistory': ({ item }: any) => renderContractors(item),
                      'item.invoices': ({ item }: any) => renderInvoices(item),
                    }}
                  </v-data-table>
                )}
              </v-card>
            </v-col>
            <v-col cols={12} md={12}>
              <v-card variant="outlined" class="fill-height">
                <v-card-title class="d-flex align-center flex-wrap">
                  <v-icon class="mr-2" icon="mdi-map-marker-outline" size="small" />
                  Залишок на обʼєкті
                  <v-spacer />
                  <ObjectStockOps objectId={id} stockRows={stockOnSite.value} onSuccess={() => refresh()} />
                </v-card-title>
                {stockOnSite.value.length === 0 ? (
                  <v-card-text class="d-flex flex-column align-center justify-center py-8">
                    <v-icon icon="mdi-check-all" size="48" class="text-medium-emphasis mb-2" />
                    <span class="text-body-2 text-medium-emphasis">Всі позиції використані або повернуті</span>
                  </v-card-text>
                ) : (
                  <v-data-table
                    headers={stockOnSiteHeaders}
                    items={stockOnSite.value}
                    hide-default-footer
                    items-per-page={-1}
                    density="compact"
                  >
                    {{
                      'item.product.sku': ({ item }: any) => <span class="whitespace-nowrap">{item.product?.sku || '—'}</span>,
                      'item.contractor': ({ item }: any) => renderLotContractor(item),
                      'item.pricePerUnit': ({ item }: any) => renderLotPrice(item),
                      'item.quantity': ({ item }: any) => (
                        <strong>{Number(item.quantity).toLocaleString('uk-UA')}</strong>
                      ),
                      'item.supplyHistory': ({ item }: any) => renderContractors(item),
                      'item.invoices': ({ item }: any) => renderInvoices(item),
                    }}
                  </v-data-table>
                )}
              </v-card>
            </v-col>
          </v-row>

          <v-card variant="outlined" class="mb-4">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" icon="mdi-package-variant-closed" size="small" />
              Відпуск зі складу (оцінка вартості)
            </v-card-title>
            <v-card-text>
              <v-row class="text-center">
                <v-col cols={4}>
                  <div class="text-body-2 text-medium-emphasis">Загальна кількість</div>
                  <div class="text-h5 font-weight-bold">{summary.value.reduce((s: number, r: any) => s + (Number(r.totalQuantity) || 0), 0)}</div>
                </v-col>
                <v-col cols={4}>
                  <div class="text-body-2 text-medium-emphasis">Сер. ціна</div>
                  <div class="text-h5 font-weight-bold">
                    {summary.value.length > 0 && summaryTotalAmount.value > 0
                      ? uah(summaryTotalAmount.value / summary.value.reduce((s: number, r: any) => s + (Number(r.totalQuantity) || 0), 0))
                      : uah(0)}
                  </div>
                </v-col>
                <v-col cols={4}>
                  <div class="text-body-2 text-medium-emphasis">Сума</div>
                  <div class="text-h5 font-weight-bold">{uah(summaryTotalAmount.value)}</div>
                </v-col>
              </v-row>
            </v-card-text>
            {summary.value.length === 0 ? (
              <v-card-text class="d-flex flex-column align-center justify-center py-6">
                <v-icon icon="mdi-package-variant-remove" size="48" class="text-medium-emphasis mb-2" />
                <span class="text-body-2 text-medium-emphasis">Немає відпусків зі складу</span>
              </v-card-text>
            ) : (
              <v-data-table
                class="object-report-summary"
                headers={summaryHeaders}
                items={summary.value}
                hide-default-footer
                items-per-page={-1}
                density="compact"
              >
                {{
                  'item.product.sku': ({ item }: any) => (
                    <span class="whitespace-nowrap">{item.product?.sku || '—'}</span>
                  ),
                  'item.contractor': ({ item }: any) => renderLotContractor(item),
                  'item.totalQuantity': ({ item }: any) => (
                    <strong>{Number(item.totalQuantity).toLocaleString('uk-UA')}</strong>
                  ),
                  'item.pricePerUnit': ({ item }: any) => renderLotPrice(item),
                  'item.totalAmount': ({ item }: any) => (
                    <strong>{uah(Number(item.totalAmount) || 0)}</strong>
                  ),
                  'item.supplyHistory': ({ item }: any) => renderContractors(item),
                  'item.invoices': ({ item }: any) => renderInvoices(item),
                }}
              </v-data-table>
            )}
          </v-card>

          <v-row class="mb-4">
            <v-col cols={12} md={6}>
              <v-card variant="outlined" class="fill-height">
                <v-card-title class="d-flex align-center">
                  <v-icon class="mr-2" icon="mdi-truck-delivery" size="small" />
                  Переміщення на обʼєкт
                </v-card-title>
                {movements.value.length === 0 ? (
                  <v-card-text class="d-flex flex-column align-center justify-center py-8">
                    <v-icon icon="mdi-truck-outline" size="48" class="text-medium-emphasis mb-2" />
                    <span class="text-body-2 text-medium-emphasis">Переміщень ще не було</span>
                  </v-card-text>
                ) : (
                  <v-data-table
                    headers={movementHeaders}
                    items={movements.value}
                    hide-default-footer
                    density="compact"
                  >
                    {{
                      'item.date': ({ item }: any) => (
                        <span>{new Date(item.date).toLocaleDateString('uk-UA')}</span>
                      ),
                      'item.itemsPreview': ({ item }: any) => movementLineItemsCell(item.items),
                      'item.notes': ({ item }: any) => (
                        <span class="text-medium-emphasis">{item.notes || '—'}</span>
                      ),
                      'item.link': ({ item }: any) => (
                        <v-btn icon="mdi-eye" variant="text" size="small" color="primary" to={`/movements/${item.id}`} />
                      ),
                    }}
                  </v-data-table>
                )}
              </v-card>
            </v-col>
            <v-col cols={12} md={6}>
              <v-card variant="outlined" class="fill-height">
                <v-card-title class="d-flex align-center">
                  <v-icon class="mr-2" icon="mdi-keyboard-return" size="small" />
                  Повернення на склад
                </v-card-title>
                {returnMovements.value.length === 0 ? (
                  <v-card-text class="d-flex flex-column align-center justify-center py-8">
                    <v-icon icon="mdi-arrow-left-bold-outline" size="48" class="text-medium-emphasis mb-2" />
                    <span class="text-body-2 text-medium-emphasis">Повернень ще не було</span>
                  </v-card-text>
                ) : (
                  <v-data-table
                    headers={returnLogHeaders}
                    items={returnMovements.value}
                    hide-default-footer
                    density="compact"
                  >
                    {{
                      'item.date': ({ item }: any) => (
                        <span>{new Date(item.date).toLocaleDateString('uk-UA')}</span>
                      ),
                      'item.itemsPreview': ({ item }: any) => movementLineItemsCell(item.items),
                      'item.notes': ({ item }: any) => (
                        <span class="text-medium-emphasis">{item.notes || '—'}</span>
                      ),
                      'item.link': ({ item }: any) => (
                        <v-btn icon="mdi-eye" variant="text" size="small" color="primary" to={`/movements/${item.id}`} />
                      ),
                    }}
                  </v-data-table>
                )}
              </v-card>
            </v-col>
          </v-row>

          <v-card variant="outlined">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" icon="mdi-history" size="small" />
              Історія змін
            </v-card-title>
            <AuditLogPanel entityType="ConstructionObject" entityId={id} />
          </v-card>
        </>
      )
    }

    function renderMaterialsTab() {
      return (
        <>
          <v-card variant="outlined" class="mb-4">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" icon="mdi-package-variant-closed" size="small" />
              Відпуск зі складу на обʼєкт (для оцінки вартості)
              <v-chip class="ml-3" size="small" variant="tonal" color="primary">
                {summary.value.length} позицій
              </v-chip>
            </v-card-title>
            {summaryHasMissingPrice.value && (
              <v-card-text class="text-body-2 text-medium-emphasis pt-0">
                Сума за оцінкою: для кожного відпуску береться остання ціна з накладної на той самий
                склад, звідки відпущено товар. Для деяких залишків ціна в накладних не знайдена — у
                таблиці &quot;Сер. ціна&quot; стоїть &quot;—&quot; і рядок може бути оцінений
                неповно.
              </v-card-text>
            )}
            <v-data-table
              class="object-report-summary"
              headers={summaryHeaders}
              items={summary.value}
              hide-default-footer
              items-per-page={-1}
            >
              {{
                'item.product.sku': ({ item }: any) => (
                  <span class="whitespace-nowrap">{item.product?.sku || '—'}</span>
                ),
                'item.contractor': ({ item }: any) => renderLotContractor(item),
                'item.totalQuantity': ({ item }: any) => (
                  <strong>{Number(item.totalQuantity).toLocaleString('uk-UA')}</strong>
                ),
                'item.pricePerUnit': ({ item }: any) => renderLotPrice(item),
                'item.totalAmount': ({ item }: any) => (
                  <strong>{uah(Number(item.totalAmount) || 0)}</strong>
                ),
                'item.supplyHistory': ({ item }: any) => renderContractors(item),
                'item.invoices': ({ item }: any) => renderInvoices(item),
              }}
            </v-data-table>
            <v-divider />
            <v-card-text class="d-flex justify-end py-3">
              <div class="text-h6">
                <span class="text-medium-emphasis text-body-1">Всього за матеріалами: </span>
                <span class="font-weight-bold">{uah(summaryTotalAmount.value)}</span>
              </div>
            </v-card-text>
          </v-card>

          <v-card variant="outlined">
            <v-card-title class="d-flex align-center flex-wrap gap-2">
              <v-icon class="mr-2" icon="mdi-check-circle-outline" size="small" />
              Використано на обʼєкті
              <v-chip size="small" variant="tonal" color="success">
                {consumedSummary.value.length} позицій
              </v-chip>
              <v-spacer />
              {writeOffMovements.value.length > 0 && (
                <v-btn
                  color="success"
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-history"
                  class="no-print"
                  onClick={() => (writeOffLogOpen.value = true)}
                >
                  Журнал використань
                </v-btn>
              )}
            </v-card-title>
            {consumedSummary.value.length > 0 && consumedHasMissingPrice.value && (
              <v-card-text class="text-body-2 text-medium-emphasis pt-0">
                Оцінка вартості: для кожного товару використовується середньозважена ціна з відпусків на
                обʼєкт. Якщо для товару не вдалося відновити ціну —
                колонки показують «—», загальна сума рахує лише рядки з відомою ціною.
              </v-card-text>
            )}
            {consumedSummary.value.length === 0 ? (
              <v-card-text>
                <v-alert type="info" variant="tonal" density="compact">
                  Використань ще не було.
                </v-alert>
              </v-card-text>
            ) : (
              <>
                <v-data-table
                  headers={consumedHeaders}
                  items={consumedSummary.value}
                  hide-default-footer
                  items-per-page={-1}
                  density="compact"
                >
                  {{
                    'item.product.name': ({ item }: any) => (
                      <span class="text-body-2">{item.product?.name ?? '—'}</span>
                    ),
                    'item.product.sku': ({ item }: any) => <span class="whitespace-nowrap">{item.product?.sku || '—'}</span>,
                    'item.contractor': ({ item }: any) => renderLotContractor(item),
                    'item.totalQuantity': ({ item }: any) => (
                      <strong>{Number(item.totalQuantity).toLocaleString('uk-UA')}</strong>
                    ),
                    'item.pricePerUnit': ({ item }: any) => renderLotPrice(item),
                    'item.totalAmount': ({ item }: any) =>
                      item.hasMissingPrice ? (
                        <span class="text-medium-emphasis">—</span>
                      ) : (
                        <strong>{uah(Number(item.totalAmount) || 0)}</strong>
                      ),
                    'item.supplyHistory': ({ item }: any) => renderContractors(item),
                    'item.invoices': ({ item }: any) => renderInvoices(item),
                  }}
                </v-data-table>
                <v-divider />
                <v-card-text class="d-flex justify-end py-3">
                  <div class="text-h6">
                    <span class="text-medium-emphasis text-body-1">Всього використано (оцінка): </span>
                    <span class="font-weight-bold">{uah(consumedTotalAmount.value)}</span>
                  </div>
                </v-card-text>
              </>
            )}
          </v-card>
        </>
      )
    }

    function renderLaborTab() {
      return (
        <v-card variant="outlined">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" icon="mdi-account-clock-outline" size="small" />
            Праця на обʼєкті
            <v-chip class="ml-3" size="small" variant="tonal" color="secondary">
              {laborLogCount.value} записів часу · {laborByUser.value.length} працівників
            </v-chip>
          </v-card-title>
          {laborHasMissingRate.value && (
            <v-card-text class="text-body-2 text-medium-emphasis pt-0">
              Для деяких працівників не задана погодинна ставка в профілі — колонка «Сума» для них
              показує «—»; загальна сума враховує лише рядки з відомою ставкою.
            </v-card-text>
          )}
          <v-data-table
            headers={laborHeaders}
            items={laborByUser.value}
            hide-default-footer
            items-per-page={-1}
          >
            {{
              'item.totalHours': ({ item }: any) => <strong>{hoursStr(Number(item.totalHours) || 0)}</strong>,
              'item.hourlyRate': ({ item }: any) =>
                item.hourlyRate == null ? (
                  <span class="text-medium-emphasis">—</span>
                ) : (
                  <span>{uah(Number(item.hourlyRate))}</span>
                ),
              'item.totalAmount': ({ item }: any) =>
                item.totalAmount == null ? (
                  <span class="text-medium-emphasis">—</span>
                ) : (
                  <strong>{uah(Number(item.totalAmount))}</strong>
                ),
            }}
          </v-data-table>
          <v-divider />
          <v-card-text class="d-flex justify-end py-3">
            <div class="text-h6">
              <span class="text-medium-emphasis text-body-1">Всього годин: </span>
              <span class="font-weight-bold mr-4">{hoursStr(laborTotalHours.value)}</span>
              <span class="text-medium-emphasis text-body-1">Всього за працею (оцінка): </span>
              <span class="font-weight-bold">{uah(laborTotalAmount.value)}</span>
            </div>
          </v-card-text>
        </v-card>
      )
    }

    function renderMovementsTab() {
      return (
        <>
          <v-card variant="outlined" class="mb-4">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" icon="mdi-truck-delivery" size="small" />
              Переміщення на обʼєкт (відпуск зі складу)
            </v-card-title>
            {movements.value.length === 0 ? (
              <v-card-text class="d-flex flex-column align-center justify-center py-8">
                <v-icon icon="mdi-truck-outline" size="48" class="text-medium-emphasis mb-2" />
                <span class="text-body-2 text-medium-emphasis">Переміщень ще не було</span>
              </v-card-text>
            ) : (
              <v-data-table headers={movementHeaders} items={movements.value}>
                {{
                  'item.date': ({ item }: any) => (
                    <span>{new Date(item.date).toLocaleDateString('uk-UA')}</span>
                  ),
                  'item.itemsPreview': ({ item }: any) => movementLineItemsCell(item.items),
                  'item.notes': ({ item }: any) => (
                    <span class="text-medium-emphasis">{item.notes || '—'}</span>
                  ),
                  'item.link': ({ item }: any) => (
                    <v-btn icon="mdi-eye" variant="text" size="small" color="primary" to={`/movements/${item.id}`} />
                  ),
                }}
              </v-data-table>
            )}
          </v-card>

          <v-card variant="outlined">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" icon="mdi-keyboard-return" size="small" />
              Повернення з обʼєкта на склад
            </v-card-title>
            {returnMovements.value.length === 0 ? (
              <v-card-text class="d-flex flex-column align-center justify-center py-8">
                <v-icon icon="mdi-arrow-left-bold-outline" size="48" class="text-medium-emphasis mb-2" />
                <span class="text-body-2 text-medium-emphasis">Повернень ще не було</span>
              </v-card-text>
            ) : (
              <v-data-table headers={returnLogHeaders} items={returnMovements.value} hide-default-footer>
                {{
                  'item.date': ({ item }: any) => (
                    <span>{new Date(item.date).toLocaleDateString('uk-UA')}</span>
                  ),
                  'item.itemsPreview': ({ item }: any) => movementLineItemsCell(item.items),
                  'item.notes': ({ item }: any) => (
                    <span class="text-medium-emphasis">{item.notes || '—'}</span>
                  ),
                  'item.link': ({ item }: any) => (
                    <v-btn icon="mdi-eye" variant="text" size="small" color="primary" to={`/movements/${item.id}`} />
                  ),
                }}
              </v-data-table>
            )}
          </v-card>
        </>
      )
    }

    function renderHistoryTab() {
      return (
        <v-card variant="outlined">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" icon="mdi-history" size="small" />
            Історія змін
          </v-card-title>
          <AuditLogPanel entityType="ConstructionObject" entityId={id} />
        </v-card>
      )
    }

    return () => (
      <div>
        <div class="page-toolbar no-print">
          <v-btn variant="outlined" prepend-icon="mdi-arrow-left" to="/reports" class="mr-2">
            Назад
          </v-btn>
          <div class="text-h5 font-weight-bold">{object.value?.name ?? '...'}</div>
          {object.value && (
            <v-chip class="ml-3" color={STATUS_COLORS[object.value.status]} variant="tonal" size="small">
              {STATUS_LABELS[object.value.status]}
            </v-chip>
          )}
          <v-spacer />
          <v-btn prepend-icon="mdi-printer" variant="outlined" onClick={printReport}>
            Друкувати
          </v-btn>
        </div>

        {pending.value && <v-progress-linear indeterminate color="primary" />}

        {report.value && (
          <>
            {budget.value != null && (
              <v-card class="mb-4">
                <v-card-title class="d-flex align-center">
                  <v-icon class="mr-2" icon="mdi-cash-check" />
                  Бюджет обʼєкта
                </v-card-title>
                <v-card-text>
                  <v-row>
                    <v-col cols={12} sm={6} md={3}>
                      <div class="text-body-2 text-medium-emphasis">Бюджет</div>
                      <div class="text-h6 font-weight-bold">{uah(budget.value)}</div>
                    </v-col>
                    <v-col cols={12} sm={6} md={3}>
                      <div class="text-body-2 text-medium-emphasis">Матеріали</div>
                      <div class="text-h6">{uah(summaryTotalAmount.value)}</div>
                    </v-col>
                    <v-col cols={12} sm={6} md={3}>
                      <div class="text-body-2 text-medium-emphasis">Праця</div>
                      <div class="text-h6">{uah(laborTotalAmount.value)}</div>
                    </v-col>
                    <v-col cols={12} sm={6} md={3}>
                      <div class="text-body-2 text-medium-emphasis">Залишок</div>
                      <div class={`text-h6 font-weight-bold ${budgetRemaining.value != null && budgetRemaining.value < 0 ? 'text-error' : 'text-success'}`}>
                        {budgetRemaining.value != null ? uah(budgetRemaining.value) : '—'}
                      </div>
                    </v-col>
                  </v-row>

                  <v-progress-linear
                    model-value={Math.min(budgetUsedPercent.value ?? 0, 100)}
                    color={budgetUsedPercent.value != null && budgetUsedPercent.value > 100 ? 'error' : budgetUsedPercent.value != null && budgetUsedPercent.value > 80 ? 'warning' : 'success'}
                    height={24}
                    rounded
                    class="mt-4"
                  >
                    {{
                      default: () => (
                        <span class="text-body-2 font-weight-medium">
                          {budgetUsedPercent.value != null ? `${budgetUsedPercent.value}%` : '—'}
                        </span>
                      ),
                    }}
                  </v-progress-linear>

                  {budgetUsedPercent.value != null && budgetUsedPercent.value > 100 && (
                    <v-alert type="error" variant="tonal" density="compact" class="mt-3">
                      Бюджет перевищено на {uah(Math.abs(budgetRemaining.value!))}
                    </v-alert>
                  )}
                  {(summaryHasMissingPrice.value || laborHasMissingRate.value) && (
                    <v-alert type="warning" variant="tonal" density="compact" class="mt-3">
                      Оцінка витрат неповна: {summaryHasMissingPrice.value ? 'для деяких матеріалів невідома ціна' : ''}
                      {summaryHasMissingPrice.value && laborHasMissingRate.value ? '; ' : ''}
                      {laborHasMissingRate.value ? 'для деяких працівників не задана ставка' : ''}.
                    </v-alert>
                  )}
                </v-card-text>
              </v-card>
            )}

            {payStatus.value && (payStatus.value.totalScheduled > 0 || payStatus.value.totalPaid > 0) && (
              <v-card class="mb-4">
                <v-card-title class="d-flex align-center">
                  <v-icon class="mr-2" icon="mdi-bank-transfer" />
                  Статус оплати
                </v-card-title>
                <v-card-text>
                  <v-row>
                    <v-col cols={12} sm={6} md={3}>
                      <div class="text-body-2 text-medium-emphasis">Виставлено</div>
                      <div class="text-h6 font-weight-bold">{uah(payStatus.value.totalScheduled)}</div>
                    </v-col>
                    <v-col cols={12} sm={6} md={3}>
                      <div class="text-body-2 text-medium-emphasis">Оплачено клієнтом</div>
                      <div class="text-h6 text-success">{uah(payStatus.value.totalPaid)}</div>
                    </v-col>
                    <v-col cols={12} sm={6} md={3}>
                      <div class="text-body-2 text-medium-emphasis">Борг</div>
                      <div class={`text-h6 font-weight-bold ${payStatus.value.debt > 0 ? 'text-error' : 'text-success'}`}>
                        {uah(payStatus.value.debt)}
                      </div>
                    </v-col>
                    <v-col cols={12} sm={6} md={3}>
                      <div class="text-body-2 text-medium-emphasis">Прибуток</div>
                      <div class={`text-h6 font-weight-bold ${payStatus.value.profit >= 0 ? 'text-success' : 'text-error'}`}>
                        {uah(payStatus.value.profit)}
                      </div>
                    </v-col>
                  </v-row>
                  {payStatus.value.totalScheduled > 0 && (
                    <v-progress-linear
                      model-value={Math.min((payStatus.value.totalPaid / payStatus.value.totalScheduled) * 100, 100)}
                      color={payStatus.value.debt > 0 ? 'warning' : 'success'}
                      height={20}
                      rounded
                      class="mt-4"
                    >
                      {{
                        default: () => (
                          <span class="text-body-2 font-weight-medium">
                            {Math.round((payStatus.value.totalPaid / payStatus.value.totalScheduled) * 100)}% оплачено
                          </span>
                        ),
                      }}
                    </v-progress-linear>
                  )}
                </v-card-text>
                <v-card-actions>
                  <v-btn variant="text" color="primary" prepend-icon="mdi-open-in-new" to={`/payments?objectId=${id}`}>
                    Переглянути оплати
                  </v-btn>
                </v-card-actions>
              </v-card>
            )}

            {renderSummaryStats()}

            <v-tabs v-model={activeTab.value} class="mb-4" color="primary">
              <v-tab value="overview" prepend-icon="mdi-view-dashboard-outline">Огляд</v-tab>
              <v-tab value="materials" prepend-icon="mdi-package-variant">
                Матеріали
                <v-chip class="ml-2" size="x-small" variant="tonal">{summary.value.length}</v-chip>
              </v-tab>
              <v-tab value="labor" prepend-icon="mdi-account-clock-outline">
                Праця
                <v-chip class="ml-2" size="x-small" variant="tonal">{laborLogCount.value}</v-chip>
              </v-tab>
              <v-tab value="movements" prepend-icon="mdi-swap-horizontal">
                Переміщення
                <v-chip class="ml-2" size="x-small" variant="tonal">{movements.value.length}</v-chip>
              </v-tab>
              <v-tab value="history" prepend-icon="mdi-history">Історія</v-tab>
            </v-tabs>

            <v-window v-model={activeTab.value}>
              <v-window-item value="overview">{renderOverviewTab()}</v-window-item>
              <v-window-item value="materials">{renderMaterialsTab()}</v-window-item>
              <v-window-item value="labor">{renderLaborTab()}</v-window-item>
              <v-window-item value="movements">{renderMovementsTab()}</v-window-item>
              <v-window-item value="history">{renderHistoryTab()}</v-window-item>
            </v-window>

            <v-dialog v-model={writeOffLogOpen.value} max-width={720} scrollable class="no-print">
              <v-card>
                <v-card-title class="d-flex align-center flex-wrap gap-2">
                  <v-icon icon="mdi-history" class="mr-1" />
                  Журнал використань
                  <v-chip size="small" variant="tonal" color="success">
                    {writeOffMovements.value.length}
                  </v-chip>
                  <v-spacer />
                  <v-btn
                    icon="mdi-close"
                    variant="text"
                    aria-label="Закрити"
                    onClick={() => (writeOffLogOpen.value = false)}
                  />
                </v-card-title>
                <v-divider />
                <v-card-text class="px-0 pt-2">
                  <v-data-table
                    headers={writeOffLogHeaders}
                    items={writeOffMovements.value}
                    hide-default-footer
                    density="compact"
                  >
                    {{
                      'item.date': ({ item }: any) => (
                        <span>{new Date(item.date).toLocaleDateString('uk-UA')}</span>
                      ),
                      'item.items': ({ item }: any) => (
                        <v-chip size="small" variant="outlined">{item.items?.length ?? 0}</v-chip>
                      ),
                      'item.notes': ({ item }: any) => (
                        <span class="text-medium-emphasis">{item.notes || '—'}</span>
                      ),
                      'item.link': ({ item }: any) => (
                        <v-btn icon="mdi-eye" variant="text" size="small" color="primary" to={`/movements/${item.id}`} />
                      ),
                    }}
                  </v-data-table>
                </v-card-text>
                <v-divider />
                <v-card-actions class="justify-end">
                  <v-btn variant="text" onClick={() => (writeOffLogOpen.value = false)}>
                    Закрити
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </>
        )}
      </div>
    )
  },
})
