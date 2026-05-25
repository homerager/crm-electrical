export default defineComponent({
  name: 'InvoicesPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({
      title: 'Накладні'
    })

    const filterType = ref<string | null>(null)
    const search = ref('')
    const filterContractorId = ref<string | null>(null)
    const filterWarehouseId = ref<string | null>(null)
    const filterObjectId = ref<string | null>(null)

    const fetchQuery = computed(() => {
      const q: Record<string, string> = {}
      if (filterType.value) q.type = filterType.value
      if (search.value) q.search = search.value
      if (filterContractorId.value) q.contractorId = filterContractorId.value
      if (filterWarehouseId.value) q.warehouseId = filterWarehouseId.value
      if (filterObjectId.value) q.objectId = filterObjectId.value
      return q
    })

    const { data, pending, refresh } = useFetch('/api/invoices', { query: fetchQuery })
    const invoices = computed(() => (data.value as any)?.invoices ?? [])

    const { data: contractorsData } = useFetch('/api/contractors')
    const contractors = computed(() => (contractorsData.value as any)?.contractors ?? [])

    const { data: warehousesData } = useFetch('/api/warehouses')
    const warehouses = computed(() => (warehousesData.value as any)?.warehouses ?? [])

    const { data: objectsData } = useFetch('/api/objects')
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])

    const typeOptions = [
      { title: 'Всі', value: null },
      { title: 'Прихід', value: 'INCOMING' },
      { title: 'Видаток', value: 'OUTGOING' },
    ]

    const headers = [
      { title: '№', key: 'number', width: 100 },
      { title: 'Тип', key: 'type', width: 120 },
      { title: 'Дата', key: 'date', width: 120 },
      { title: 'Призначення', key: 'destination' },
      { title: 'Контрагент', key: 'contractor.name' },
      { title: 'Позицій', key: 'items', sortable: false, width: 100 },
      { title: 'Автор', key: 'createdBy.name', width: 140 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 80 },
    ]

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Накладні</div>
          <v-spacer />
          <TableExportBtn
            class="mr-2"
            filename="Накладні"
            rows={invoices.value}
            columns={[
              { title: '№', key: 'number' },
              { title: 'Тип', key: 'type', format: (v) => (v === 'INCOMING' ? 'Прихід' : v === 'OUTGOING' ? 'Видаток' : v) },
              { title: 'Дата', key: 'date', format: (v) => (v ? new Date(v).toLocaleDateString('uk-UA') : '') },
              { title: 'Склад', key: 'warehouse.name' },
              { title: "Об'єкт", key: 'object.name' },
              { title: 'Контрагент', key: 'contractor.name' },
              { title: 'Позицій', key: 'items', format: (v) => (Array.isArray(v) ? v.length : 0) },
              { title: 'Автор', key: 'createdBy.name' },
            ]}
          />
          <v-btn color="primary" prepend-icon="mdi-plus" to="/invoices/create">
            Нова накладна
          </v-btn>
        </div>

        <v-card>
          <v-card-text class="pb-0">
            <v-row align="center" class="mb-2">
              <v-col cols={12} sm="auto">
                <v-btn-toggle v-model={filterType.value} rounded="lg" density="compact">
                  {typeOptions.map((opt) => (
                    <v-btn key={String(opt.value)} value={opt.value}>
                      {opt.title}
                    </v-btn>
                  ))}
                </v-btn-toggle>
              </v-col>
              <v-col cols={12} sm={2}>
                <v-text-field
                  v-model={search.value}
                  label="Пошук за номером"
                  prepend-inner-icon="mdi-magnify"
                  clearable
                  hide-details
                  density="compact"
                />
              </v-col>
              <v-col cols={12} sm={2}>
                <v-select
                  v-model={filterContractorId.value}
                  label="Контрагент"
                  items={contractors.value}
                  item-title="name"
                  item-value="id"
                  clearable
                  hide-details
                  density="compact"
                />
              </v-col>
              <v-col cols={12} sm={2}>
                <v-select
                  v-model={filterWarehouseId.value}
                  label="Склад"
                  items={warehouses.value}
                  item-title="name"
                  item-value="id"
                  clearable
                  hide-details
                  density="compact"
                />
              </v-col>
              <v-col cols={12} sm={2}>
                <v-select
                  v-model={filterObjectId.value}
                  label="Обʼєкт"
                  items={objects.value}
                  item-title="name"
                  item-value="id"
                  clearable
                  hide-details
                  density="compact"
                />
              </v-col>
            </v-row>
          </v-card-text>
          <v-data-table headers={headers} items={invoices.value} loading={pending.value} hover>
            {{
              'item.type': ({ item }: any) => (
                <v-chip size="small" color={item.type === 'INCOMING' ? 'success' : 'error'} variant="tonal">
                  {item.type === 'INCOMING' ? 'Прихід' : 'Видаток'}
                </v-chip>
              ),
              'item.date': ({ item }: any) => (
                <span>{new Date(item.date).toLocaleDateString('uk-UA')}</span>
              ),
              'item.destination': ({ item }: any) => {
                if (item.warehouse) {
                  return (
                    <span>
                      <v-icon size="small" class="mr-1">mdi-warehouse</v-icon>
                      {item.warehouse.name}
                    </span>
                  )
                }
                if (item.object) {
                  return (
                    <span>
                      <v-icon size="small" class="mr-1">mdi-office-building</v-icon>
                      {item.object.name}
                    </span>
                  )
                }
                return <span>—</span>
              },
              'item.contractor.name': ({ item }: any) => (
                <span>{item.contractor?.name || '—'}</span>
              ),
              'item.items': ({ item }: any) => (
                <v-chip size="small" variant="outlined">{item.items?.length ?? 0}</v-chip>
              ),
              'item.actions': ({ item }: any) => (
                <v-btn icon="mdi-eye" variant="text" size="small" to={`/invoices/${item.id}`} />
              ),
            }}
          </v-data-table>
        </v-card>
      </div>
    )
  },
})
