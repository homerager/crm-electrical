export default defineComponent({
  name: 'WarehouseDetailPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const id = route.params.id as string

    const { data, pending } = useFetch(`/api/warehouses/${id}`)
    const warehouse = computed(() => (data.value as any)?.warehouse)

    const tab = ref('stock')
    const directionFilter = ref<'in' | 'out' | null>(null)

    const { data: movData, pending: movPending } = useFetch(
      `/api/warehouses/${id}/movements`,
      { query: computed(() => directionFilter.value ? { direction: directionFilter.value } : {}) },
    )
    const movements = computed(() => (movData.value as any)?.movements ?? [])

    const expandedRows = ref<string[]>([])
    function toggleExpand(movId: string) {
      const idx = expandedRows.value.indexOf(movId)
      if (idx === -1) expandedRows.value.push(movId)
      else expandedRows.value.splice(idx, 1)
    }

    const stockHeaders = [
      { title: 'Товар', key: 'product.name' },
      { title: 'Артикул', key: 'product.sku' },
      { title: 'Кількість', key: 'quantity', align: 'end' as const },
      { title: 'Одиниця', key: 'product.unit', align: 'end' as const },
    ]

    const movHeaders = [
      { title: '', key: 'expand', sortable: false, width: 48 },
      { title: 'Напрямок', key: 'direction', sortable: false, width: 150 },
      { title: 'Дата', key: 'date', width: 120 },
      { title: 'Звідки', key: 'from', sortable: false },
      { title: 'Куди', key: 'to', sortable: false },
      { title: 'Позицій', key: 'items', sortable: false, width: 90, align: 'center' as const },
      { title: 'Автор', key: 'author', sortable: false, width: 160 },
      { title: '', key: 'link', sortable: false, width: 60 },
    ]

    function isIncoming(mov: any) {
      return mov.toWarehouseId === id
    }

    const directionOptions = [
      { title: 'Всі', value: null },
      { title: 'Надходження', value: 'in' },
      { title: 'Відправлення', value: 'out' },
    ]

    return () => (
      <div>
        <div class="d-flex align-center mb-4">
          <v-btn icon="mdi-arrow-left" variant="text" to="/warehouses" class="mr-2" />
          <div class="text-h5 font-weight-bold">{warehouse.value?.name ?? '...'}</div>
          <v-spacer />
          {warehouse.value && (
            <v-chip color={warehouse.value.isActive ? 'success' : 'default'} variant="tonal">
              {warehouse.value.isActive ? 'Активний' : 'Неактивний'}
            </v-chip>
          )}
        </div>

        {warehouse.value?.address && (
          <v-alert icon="mdi-map-marker" variant="tonal" color="info" class="mb-4">
            {warehouse.value.address}
          </v-alert>
        )}

        {warehouse.value?.description && (
          <p class="text-body-1 mb-4">{warehouse.value.description}</p>
        )}

        <v-tabs v-model={tab.value} class="mb-4">
          <v-tab value="stock" prepend-icon="mdi-package-variant-closed">Залишки</v-tab>
          <v-tab value="movements" prepend-icon="mdi-swap-horizontal">Переміщення</v-tab>
        </v-tabs>

        {tab.value === 'stock' && (
          <v-card>
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" icon="mdi-package-variant-closed" />
              Залишки на складі
            </v-card-title>
            <v-data-table
              headers={stockHeaders}
              items={warehouse.value?.stock ?? []}
              loading={pending.value}
              hover
            >
              {{
                'item.quantity': ({ item }: any) => (
                  <span class={Number(item.quantity) < 5 ? 'text-error font-weight-bold' : ''}>
                    {Number(item.quantity).toLocaleString('uk-UA')}
                  </span>
                ),
              }}
            </v-data-table>
          </v-card>
        )}

        {tab.value === 'movements' && (
          <v-card>
            <v-card-text class="pb-0">
              <v-btn-toggle
                v-model={directionFilter.value}
                rounded="lg"
                density="compact"
                class="mb-2"
              >
                {directionOptions.map((opt) => (
                  <v-btn key={String(opt.value)} value={opt.value}>
                    {opt.title}
                  </v-btn>
                ))}
              </v-btn-toggle>
            </v-card-text>

            <v-data-table
              headers={movHeaders}
              items={movements.value}
              loading={movPending.value}
              hover
              item-value="id"
            >
              {{
                'item.expand': ({ item }: any) => (
                  <v-btn
                    icon={expandedRows.value.includes(item.id) ? 'mdi-chevron-up' : 'mdi-chevron-down'}
                    variant="text"
                    size="small"
                    onClick={() => toggleExpand(item.id)}
                  />
                ),
                'item.direction': ({ item }: any) => {
                  const incoming = isIncoming(item)
                  return (
                    <v-chip
                      size="small"
                      color={incoming ? 'success' : 'warning'}
                      variant="tonal"
                      prepend-icon={incoming ? 'mdi-arrow-down-circle' : 'mdi-arrow-up-circle'}
                    >
                      {incoming ? 'Надходження' : 'Відправлення'}
                    </v-chip>
                  )
                },
                'item.date': ({ item }: any) => (
                  <span>{new Date(item.date).toLocaleDateString('uk-UA')}</span>
                ),
                'item.from': ({ item }: any) => (
                  <span>{item.fromWarehouse?.name ?? '—'}</span>
                ),
                'item.to': ({ item }: any) => (
                  <span>
                    {item.type === 'WAREHOUSE_TO_WAREHOUSE'
                      ? item.toWarehouse?.name
                      : item.object?.name ?? '—'}
                  </span>
                ),
                'item.items': ({ item }: any) => (
                  <v-chip size="small" variant="outlined">{item.items?.length ?? 0}</v-chip>
                ),
                'item.author': ({ item }: any) => (
                  <div class="d-flex align-center gap-1">
                    <v-icon size="small" icon="mdi-account" class="text-medium-emphasis" />
                    <span>{item.createdBy?.name}</span>
                  </div>
                ),
                'item.link': ({ item }: any) => (
                  <v-btn
                    icon="mdi-eye"
                    variant="text"
                    size="small"
                    color="primary"
                    to={`/movements/${item.id}`}
                  />
                ),
                'expanded-row': ({ item }: any) =>
                  expandedRows.value.includes(item.id) ? (
                    <tr>
                      <td colspan={8} class="pa-0">
                        <v-table density="compact" class="bg-surface-variant">
                          <thead>
                            <tr>
                              <th class="text-left pl-10">Товар</th>
                              <th class="text-left">Артикул</th>
                              <th class="text-right">Кількість</th>
                              <th class="text-left">Одиниця</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.items.map((line: any) => (
                              <tr key={line.id}>
                                <td class="pl-10">{line.product.name}</td>
                                <td>
                                  <v-chip size="x-small" variant="outlined">
                                    {line.product.sku || '—'}
                                  </v-chip>
                                </td>
                                <td class="text-right font-weight-medium">
                                  {Number(line.quantity).toLocaleString('uk-UA')}
                                </td>
                                <td class="text-medium-emphasis">{line.product.unit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </v-table>
                      </td>
                    </tr>
                  ) : null,
              }}
            </v-data-table>
          </v-card>
        )}
      </div>
    )
  },
})
