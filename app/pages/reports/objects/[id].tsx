export default defineComponent({
  name: 'ObjectReportPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const id = route.params.id as string
    const { data, pending } = useFetch(`/api/reports/objects/${id}`)

    const report = computed(() => data.value as any)
    const object = computed(() => report.value?.object)

    useHead({
      title: computed(() => object.value ? `Репорт: ${object.value.name}` : 'Репорт обʼєкта')
    })
    const summary = computed(() => report.value?.summary ?? [])
    const movements = computed(() => report.value?.movements ?? [])
    const summaryTotalAmount = computed(() => Number(report.value?.summaryTotalAmount) || 0)
    const summaryHasMissingPrice = computed(() => report.value?.summaryHasMissingPrice === true)

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
      { title: 'Склад', key: 'fromWarehouse.name' },
      { title: 'Позицій', key: 'items', sortable: false, width: 100 },
      { title: 'Автор', key: 'createdBy.name', width: 140 },
      { title: 'Примітки', key: 'notes' },
    ]

    function printReport() {
      window.print()
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

    return () => (
      <div>
        <div class="d-flex align-center mb-4 no-print">
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
            <v-card class="mb-4">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" icon="mdi-package-variant-closed" />
                Використані матеріали (зведення)
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
                    <span>{item.product?.sku || '—'}</span>
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

            <v-card>
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" icon="mdi-truck-delivery" />
                Переміщення на обʼєкт
              </v-card-title>
              <v-data-table headers={movementHeaders} items={movements.value}>
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
            </v-card>
          </>
        )}
      </div>
    )
  },
})
