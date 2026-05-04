export default defineComponent({
  name: 'MovementsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({
      title: 'Переміщення'
    })

    const filterType = ref<string | null>(null)
    const { data, pending } = useFetch('/api/movements', {
      query: computed(() => (filterType.value ? { type: filterType.value } : {})),
    })
    const movements = computed(() => (data.value as any)?.movements ?? [])

    const typeOptions = [
      { title: 'Всі', value: null },
      { title: 'Між складами', value: 'WAREHOUSE_TO_WAREHOUSE' },
      { title: 'На обʼєкт', value: 'WAREHOUSE_TO_OBJECT' },
      { title: 'Списання з обʼєкта', value: 'OBJECT_WRITE_OFF' },
      { title: 'Повернення на склад', value: 'OBJECT_TO_WAREHOUSE' },
    ]

    function movementChip(type: string) {
      switch (type) {
        case 'WAREHOUSE_TO_WAREHOUSE':
          return { label: 'Між складами', color: 'primary', icon: 'mdi-swap-horizontal' as const }
        case 'WAREHOUSE_TO_OBJECT':
          return { label: 'На обʼєкт', color: 'warning', icon: 'mdi-truck-delivery' as const }
        case 'OBJECT_WRITE_OFF':
          return { label: 'Списання', color: 'error', icon: 'mdi-minus-circle-outline' as const }
        case 'OBJECT_TO_WAREHOUSE':
          return { label: 'Повернення', color: 'success', icon: 'mdi-keyboard-return' as const }
        default:
          return { label: type, color: 'grey', icon: 'mdi-help' as const }
      }
    }

    function destinationLabel(item: any) {
      if (item.type === 'WAREHOUSE_TO_WAREHOUSE') return item.toWarehouse?.name ?? '—'
      if (item.type === 'WAREHOUSE_TO_OBJECT') return item.object?.name ?? '—'
      if (item.type === 'OBJECT_WRITE_OFF') return item.object ? `${item.object.name} · списано` : '—'
      if (item.type === 'OBJECT_TO_WAREHOUSE') {
        const o = item.object?.name ?? 'Обʼєкт'
        const w = item.toWarehouse?.name ?? '—'
        return `${o} → ${w}`
      }
      return '—'
    }

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
        <div class="page-toolbar">
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
              'item.type': ({ item }: any) => {
                const chip = movementChip(item.type)
                return (
                  <v-chip size="small" color={chip.color} variant="tonal" prepend-icon={chip.icon}>
                    {chip.label}
                  </v-chip>
                )
              },
              'item.date': ({ item }: any) => (
                <span>{new Date(item.date).toLocaleDateString('uk-UA')}</span>
              ),
              'item.destination': ({ item }: any) => <span>{destinationLabel(item)}</span>,
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
