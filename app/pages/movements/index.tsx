export default defineComponent({
  name: 'MovementsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const filterType = ref<string | null>(null)
    const { data, pending } = useFetch('/api/movements', {
      query: computed(() => (filterType.value ? { type: filterType.value } : {})),
    })
    const movements = computed(() => (data.value as any)?.movements ?? [])

    const typeOptions = [
      { title: 'Всі', value: null },
      { title: 'Між складами', value: 'WAREHOUSE_TO_WAREHOUSE' },
      { title: 'На обʼєкт', value: 'WAREHOUSE_TO_OBJECT' },
    ]

    const headers = [
      { title: 'Тип', key: 'type', width: 160 },
      { title: 'Дата', key: 'date', width: 120 },
      { title: 'Звідки', key: 'fromWarehouse.name' },
      { title: 'Куди', key: 'destination', sortable: false },
      { title: 'Позицій', key: 'items', sortable: false, width: 90 },
      { title: 'Автор', key: 'createdBy.name', width: 140 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 80 },
    ]

    return () => (
      <div>
        <div class="d-flex align-center mb-4">
          <div class="text-h5 font-weight-bold">Переміщення</div>
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-plus" to="/movements/create">
            Нове переміщення
          </v-btn>
        </div>

        <v-card>
          <v-card-text class="pb-0">
            <v-btn-toggle v-model={filterType.value} rounded="lg" density="compact" class="mb-2">
              {typeOptions.map((opt) => (
                <v-btn key={String(opt.value)} value={opt.value}>
                  {opt.title}
                </v-btn>
              ))}
            </v-btn-toggle>
          </v-card-text>
          <v-data-table headers={headers} items={movements.value} loading={pending.value} hover>
            {{
              'item.type': ({ item }: any) => (
                <v-chip
                  size="small"
                  color={item.type === 'WAREHOUSE_TO_WAREHOUSE' ? 'primary' : 'warning'}
                  variant="tonal"
                  prepend-icon={item.type === 'WAREHOUSE_TO_WAREHOUSE' ? 'mdi-swap-horizontal' : 'mdi-truck-delivery'}
                >
                  {item.type === 'WAREHOUSE_TO_WAREHOUSE' ? 'Між складами' : 'На обʼєкт'}
                </v-chip>
              ),
              'item.date': ({ item }: any) => (
                <span>{new Date(item.date).toLocaleDateString('uk-UA')}</span>
              ),
              'item.destination': ({ item }: any) => (
                <span>
                  {item.type === 'WAREHOUSE_TO_WAREHOUSE'
                    ? item.toWarehouse?.name
                    : item.object?.name}
                </span>
              ),
              'item.items': ({ item }: any) => (
                <v-chip size="small" variant="outlined">{item.items?.length ?? 0}</v-chip>
              ),
              'item.actions': ({ item }: any) => (
                <v-btn icon="mdi-eye" variant="text" size="small" to={`/movements/${item.id}`} />
              ),
            }}
          </v-data-table>
        </v-card>
      </div>
    )
  },
})
