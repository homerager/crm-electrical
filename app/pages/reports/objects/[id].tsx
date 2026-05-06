import ObjectReservationOps from '../../../components/ObjectReservationOps'
import ObjectStockOps from '../../../components/ObjectStockOps'

export default defineComponent({
  name: 'ObjectReportPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const id = route.params.id as string
    const { data, pending, refresh } = useFetch(`/api/reports/objects/${id}`)

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

    const summaryHeaders = [
      { title: 'Товар', key: 'product.name' },
      { title: 'Артикул', key: 'product.sku', width: 120 },
      { title: 'Загальна кількість', key: 'totalQuantity', align: 'end' as const, width: 160 },
      { title: 'Одиниця', key: 'unit', align: 'center' as const, width: 100 },
      {
        title: 'Сер. ціна, ₴',
        key: 'averageUnitPrice',
        align: 'end' as const,
        width: 120,
        sortable: false,
      },
      { title: 'Сума, ₴', key: 'totalAmount', align: 'end' as const, width: 130, sortable: false },
    ]

    const movementHeaders = [
      { title: 'Дата', key: 'date', width: 120 },
      { title: 'Склад', key: 'fromWarehouse.name', width: 160 },
      { title: 'Позиції', key: 'itemsPreview', sortable: false, minWidth: 220 },
      { title: 'Автор', key: 'createdBy.name', width: 140 },
      { title: 'Примітки', key: 'notes' },
    ]

    const stockOnSiteHeaders = [
      { title: 'Товар', key: 'product.name' },
      { title: 'Артикул', key: 'product.sku', width: 120 },
      { title: 'Залишок', key: 'quantity', align: 'end' as const, width: 140 },
      { title: 'Одиниця', key: 'product.unit', align: 'center' as const, width: 100 },
    ]

    const reservationHeaders = [
      { title: 'Склад', key: 'warehouse.name', width: 180 },
      { title: 'Товар', key: 'product.name' },
      { title: 'Артикул', key: 'product.sku', width: 120 },
      { title: 'Зарезервовано', key: 'quantity', align: 'end' as const, width: 140 },
      { title: 'Одиниця', key: 'product.unit', align: 'center' as const, width: 100 },
    ]

    const consumedHeaders = [
      { title: 'Товар', key: 'product.name', minWidth: 160 },
      { title: 'Артикул', key: 'product.sku', width: 112 },
      { title: 'Списано', key: 'totalQuantity', align: 'end' as const, width: 96 },
      { title: 'Одиниця', key: 'unit', align: 'center' as const, width: 88 },
      {
        title: 'Ціна за одиницю, ₴',
        key: 'averageUnitPrice',
        align: 'end' as const,
        width: 138,
        sortable: false,
      },
      { title: 'Сума, ₴', key: 'totalAmount', align: 'end' as const, width: 118, sortable: false },
    ]

    const writeOffLogHeaders = [
      { title: 'Дата', key: 'date', width: 120 },
      { title: 'Автор', key: 'createdBy.name', width: 140 },
      { title: 'Позицій', key: 'items', sortable: false, width: 100 },
      { title: 'Примітки', key: 'notes' },
    ]

    const returnLogHeaders = [
      { title: 'Дата', key: 'date', width: 120 },
      { title: 'Склад', key: 'toWarehouse.name', width: 160 },
      { title: 'Позиції', key: 'itemsPreview', sortable: false, minWidth: 220 },
      { title: 'Автор', key: 'createdBy.name', width: 140 },
      { title: 'Примітки', key: 'notes' },
    ]

    const laborHeaders = [
      { title: 'Працівник', key: 'userName' },
      { title: 'Години', key: 'totalHours', align: 'end' as const, width: 120, sortable: false },
      { title: 'Ставка, ₴/год', key: 'hourlyRate', align: 'end' as const, width: 130, sortable: false },
      { title: 'Сума, ₴', key: 'totalAmount', align: 'end' as const, width: 130, sortable: false },
    ]

    const hoursStr = (h: number) =>
      h.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

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

    return () => (
      <div>
        <div class="page-toolbar no-print">
          <v-btn icon="mdi-arrow-left" variant="text" to="/reports" class="mr-2" />
          <div>
            <div class="text-h5 font-weight-bold">{object.value?.name ?? '...'}</div>
            {object.value?.address && <div class="text-body-2 text-medium-emphasis">{object.value.address}</div>}
          </div>
          {object.value && (
            <v-chip class="ml-3" color={STATUS_COLORS[object.value.status]} variant="tonal">
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

            <v-card class="mb-4">
              <v-card-title class="d-flex align-center flex-wrap">
                <v-icon class="mr-2" icon="mdi-lock-outline" />
                Резерв на складах під цей обʼєкт
                <v-chip class="ml-3" size="small" variant="tonal" color="secondary">
                  {warehouseReservations.value.length} позицій
                </v-chip>
              </v-card-title>
              <v-card-text class="text-body-2 text-medium-emphasis">
                Товар залишається на складі; інші не можуть перемістити зарезервовану кількість на інший склад. При
                відпуску на цей обʼєкт резерв автоматично зменшується.
              </v-card-text>
              <ObjectReservationOps
                objectId={id}
                reservationRows={warehouseReservations.value}
                onSuccess={() => refresh()}
              />
              {warehouseReservations.value.length === 0 ? (
                <v-card-text>
                  <v-alert type="info" variant="tonal" density="compact">
                    Немає активних резервів на складах для цього обʼєкта.
                  </v-alert>
                </v-card-text>
              ) : (
                <v-data-table
                  headers={reservationHeaders}
                  items={warehouseReservations.value}
                  hide-default-footer
                  items-per-page={-1}
                >
                  {{
                    'item.product.sku': ({ item }: any) => (
                      <span class="whitespace-nowrap">{item.product?.sku || '—'}</span>
                    ),
                    'item.quantity': ({ item }: any) => (
                      <strong>{Number(item.quantity).toLocaleString('uk-UA')}</strong>
                    ),
                  }}
                </v-data-table>
              )}
            </v-card>

            <v-card class="mb-4">
              <v-card-title class="d-flex align-center flex-wrap">
                <v-icon class="mr-2" icon="mdi-package-variant" />
                Залишок матеріалів на обʼєкті
                <v-chip class="ml-3" size="small" variant="tonal" color="secondary">
                  {stockOnSite.value.length} позицій
                </v-chip>
              </v-card-title>
              <v-card-text class="text-body-2 text-medium-emphasis">
                Після відпуску зі складу товар обліковується тут. Списання зменшує залишок (використано в
                роботі); повернення переносить кількість обраного складу.
              </v-card-text>
              <ObjectStockOps objectId={id} stockRows={stockOnSite.value} onSuccess={() => refresh()} />
              {stockOnSite.value.length === 0 ? (
                <v-card-text>
                  <v-alert type="info" variant="tonal" density="compact">
                    Немає залишку на обʼєкті (усі позиції списані або повернуті на склад).
                  </v-alert>
                </v-card-text>
              ) : (
                <v-data-table
                  headers={stockOnSiteHeaders}
                  items={stockOnSite.value}
                  hide-default-footer
                  items-per-page={-1}
                >
                  {{
                    'item.product.sku': ({ item }: any) => <span class="whitespace-nowrap">{item.product?.sku || '—'}</span>,
                    'item.quantity': ({ item }: any) => (
                      <strong>{Number(item.quantity).toLocaleString('uk-UA')}</strong>
                    ),
                  }}
                </v-data-table>
              )}
            </v-card>

            <v-card class="mb-4">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" icon="mdi-package-variant-closed" />
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
                  'item.totalQuantity': ({ item }: any) => (
                    <strong>{Number(item.totalQuantity).toLocaleString('uk-UA')}</strong>
                  ),
                  'item.averageUnitPrice': ({ item }: any) =>
                    item.averageUnitPrice == null ? (
                      <span class="text-medium-emphasis">—</span>
                    ) : (
                      <span>{uah(item.averageUnitPrice)}</span>
                    ),
                  'item.totalAmount': ({ item }: any) => (
                    <strong>{uah(Number(item.totalAmount) || 0)}</strong>
                  ),
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

            <v-card class="mb-4">
              <v-card-title class="d-flex align-center flex-wrap gap-2">
                <v-icon class="mr-2" icon="mdi-minus-circle-outline" />
                Списано з обʼєкта (факт використання)
                <v-chip size="small" variant="tonal" color="error">
                  {consumedSummary.value.length} позицій
                </v-chip>
                <v-spacer />
                {writeOffMovements.value.length > 0 && (
                  <v-btn
                    color="error"
                    variant="tonal"
                    size="small"
                    prepend-icon="mdi-history"
                    class="no-print"
                    onClick={() => (writeOffLogOpen.value = true)}
                  >
                    Журнал списань
                  </v-btn>
                )}
              </v-card-title>
              {consumedSummary.value.length > 0 && consumedHasMissingPrice.value && (
                <v-card-text class="text-body-2 text-medium-emphasis pt-0">
                  Оцінка вартості списань: для кожного товару використовується середньозважена ціна з відпусків на
                  обʼєкт (ті самі накладні, що й у блоці вище). Якщо для товару не вдалося відновити ціну —
                  колонки показують «—», загальна сума рахує лише рядки з відомою ціною.
                </v-card-text>
              )}
              {consumedSummary.value.length === 0 ? (
                <v-card-text>
                  <v-alert type="info" variant="tonal" density="compact">
                    Списань ще не було.
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
                      'item.totalQuantity': ({ item }: any) => (
                        <strong>{Number(item.totalQuantity).toLocaleString('uk-UA')}</strong>
                      ),
                      'item.averageUnitPrice': ({ item }: any) =>
                        item.averageUnitPrice == null ? (
                          <span class="text-medium-emphasis">—</span>
                        ) : (
                          <span>{uah(item.averageUnitPrice)}</span>
                        ),
                      'item.totalAmount': ({ item }: any) =>
                        item.hasMissingPrice ? (
                          <span class="text-medium-emphasis">—</span>
                        ) : (
                          <strong>{uah(Number(item.totalAmount) || 0)}</strong>
                        ),
                    }}
                  </v-data-table>
                  <v-divider />
                  <v-card-text class="d-flex justify-end py-3">
                    <div class="text-h6">
                      <span class="text-medium-emphasis text-body-1">Всього за списаннями (оцінка): </span>
                      <span class="font-weight-bold">{uah(consumedTotalAmount.value)}</span>
                    </div>
                  </v-card-text>
                </>
              )}
            </v-card>

            <v-dialog v-model={writeOffLogOpen.value} max-width={720} scrollable class="no-print">
              <v-card>
                <v-card-title class="d-flex align-center flex-wrap gap-2">
                  <v-icon icon="mdi-history" class="mr-1" />
                  Журнал списань
                  <v-chip size="small" variant="tonal" color="error">
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

            <v-card class="mb-4">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" icon="mdi-account-clock-outline" />
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

            <v-card class="mb-4">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" icon="mdi-truck-delivery" />
                Переміщення на обʼєкт (відпуск зі складу)
              </v-card-title>
              <v-data-table headers={movementHeaders} items={movements.value}>
                {{
                  'item.date': ({ item }: any) => (
                    <span>{new Date(item.date).toLocaleDateString('uk-UA')}</span>
                  ),
                  'item.itemsPreview': ({ item }: any) => movementLineItemsCell(item.items),
                  'item.notes': ({ item }: any) => (
                    <span class="text-medium-emphasis">{item.notes || '—'}</span>
                  ),
                }}
              </v-data-table>
            </v-card>

            <v-card>
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" icon="mdi-keyboard-return" />
                Повернення з обʼєкта на склад
              </v-card-title>
              {returnMovements.value.length === 0 ? (
                <v-card-text>
                  <v-alert type="info" variant="tonal" density="compact">
                    Повернень ще не було.
                  </v-alert>
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
                  }}
                </v-data-table>
              )}
            </v-card>
          </>
        )}
      </div>
    )
  },
})
