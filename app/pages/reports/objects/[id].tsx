export default defineComponent({
  name: 'ObjectReportPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const id = route.params.id as string
    const { data, pending } = useFetch(`/api/reports/objects/${id}`)

    const report = computed(() => data.value as any)
    const object = computed(() => report.value?.object)
    const summary = computed(() => report.value?.summary ?? [])
    const movements = computed(() => report.value?.movements ?? [])

    const summaryHeaders = [
      { title: 'Товар', key: 'product.name' },
      { title: 'Артикул', key: 'product.sku', width: 120 },
      { title: 'Загальна кількість', key: 'totalQuantity', align: 'end' as const, width: 180 },
      { title: 'Одиниця', key: 'unit', align: 'center' as const, width: 100 },
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
              <v-data-table headers={summaryHeaders} items={summary.value} hide-default-footer>
                {{
                  'item.product.sku': ({ item }: any) => (
                    <span>{item.product?.sku || '—'}</span>
                  ),
                  'item.totalQuantity': ({ item }: any) => (
                    <strong>{Number(item.totalQuantity).toLocaleString('uk-UA')}</strong>
                  ),
                }}
              </v-data-table>
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
