export default defineComponent({
  name: 'InvoicesPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const filterType = ref<string | null>(null)
    const { data, pending, refresh } = useFetch('/api/invoices', {
      query: computed(() => (filterType.value ? { type: filterType.value } : {})),
    })
    const invoices = computed(() => (data.value as any)?.invoices ?? [])

    const typeOptions = [
      { title: 'Всі', value: null },
      { title: 'Прихід', value: 'INCOMING' },
      { title: 'Видаток', value: 'OUTGOING' },
    ]

    const headers = [
      { title: '№', key: 'number', width: 100 },
      { title: 'Тип', key: 'type', width: 120 },
      { title: 'Дата', key: 'date', width: 120 },
      { title: 'Склад', key: 'warehouse.name' },
      { title: 'Контрагент', key: 'contractor.name' },
      { title: 'Позицій', key: 'items', sortable: false, width: 100 },
      { title: 'Автор', key: 'createdBy.name', width: 140 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 80 },
    ]

    return () => (
      <div>
        <div class="d-flex align-center mb-4">
          <div class="text-h5 font-weight-bold">Накладні</div>
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-plus" to="/invoices/create">
            Нова накладна
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
