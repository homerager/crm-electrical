export default defineComponent({
  name: 'ReportsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({
      title: 'Репорти'
    })

    const { data, pending } = useFetch('/api/reports/stock')
    const { data: objectsData } = useFetch('/api/objects')

    const warehouses = computed(() => (data.value as any)?.warehouses ?? [])
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])

    const selectedWarehouse = ref<string | null>(null)
    const activeTab = ref('stock')

    const filteredWarehouses = computed(() => {
      if (!selectedWarehouse.value) return warehouses.value
      return warehouses.value.filter((w: any) => w.id === selectedWarehouse.value)
    })

    const allStockItems = computed(() => {
      const items: any[] = []
      for (const wh of warehouses.value) {
        for (const s of wh.stock) {
          items.push({ ...s, warehouseName: wh.name })
        }
      }
      return items
    })

    const stockHeaders = [
      { title: 'Склад', key: 'warehouseName' },
      { title: 'Товар', key: 'product.name' },
      { title: 'Артикул', key: 'product.sku', width: 120 },
      { title: 'Кількість', key: 'quantity', align: 'end' as const, width: 130 },
      { title: 'Одиниця', key: 'product.unit', align: 'center' as const, width: 100 },
    ]

    return () => (
      <div>
        <div class="text-h5 font-weight-bold mb-4">Репорти</div>

        <v-tabs v-model={activeTab.value} class="mb-4" show-arrows>
          <v-tab value="stock" prepend-icon="mdi-warehouse">Залишки на складах</v-tab>
          <v-tab value="objects" prepend-icon="mdi-office-building-outline">По обʼєктах</v-tab>
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
        </v-window>
      </div>
    )
  },
})
