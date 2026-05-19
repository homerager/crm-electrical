export default defineComponent({
  name: 'InventorySessionsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Інвентаризація' })

    const { isPrivileged } = useAuth()
    const router = useRouter()

    const { data, refresh, pending } = useFetch('/api/inventory-sessions')
    const sessions = computed(() => (data.value as any)?.sessions ?? [])

    const { data: warehousesData } = useFetch('/api/warehouses')
    const { data: objectsData } = useFetch('/api/objects')
    const warehouses = computed(() => (warehousesData.value as any)?.warehouses ?? [])
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])

    const createDialog = ref(false)
    const creating = ref(false)
    const createError = ref('')
    const createForm = reactive({ warehouseId: '', objectId: '' })

    function openCreate() {
      Object.assign(createForm, { warehouseId: '', objectId: '' })
      createError.value = ''
      createDialog.value = true
    }

    async function submitCreate() {
      creating.value = true
      createError.value = ''
      try {
        const res = await $fetch('/api/inventory-sessions', { method: 'POST', body: createForm }) as any
        createDialog.value = false
        router.push(`/equipment/inventory/${res.session.id}`)
      } catch (e: any) {
        createError.value = e?.data?.statusMessage || 'Помилка створення сесії'
      } finally {
        creating.value = false
      }
    }

    function formatDate(d: string | null) {
      if (!d) return '—'
      return new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    const headers = [
      { title: 'Локація', key: 'location', sortable: false },
      { title: 'Статус', key: 'status', width: 140 },
      { title: 'Розпочав', key: 'startedBy', sortable: false },
      { title: 'Початок', key: 'startedAt' },
      { title: 'Завершено', key: 'completedAt' },
      { title: 'Позицій', key: 'itemsCount', width: 100 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 100 },
    ]

    return () => (
      <div>
        <div class="page-toolbar">
          <v-btn icon="mdi-arrow-left" variant="text" to="/equipment" />
          <div class="text-h5 font-weight-bold ml-2">Інвентаризація</div>
          <v-spacer />
          {isPrivileged.value && (
            <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
              Нова сесія
            </v-btn>
          )}
        </div>

        <v-card>
          <v-data-table
            headers={headers}
            items={sessions.value}
            loading={pending.value}
            hover
            items-per-page={20}
          >
            {{
              'item.location': ({ item }: any) => (
                <span>
                  {item.warehouse
                    ? <><v-icon size="small" class="mr-1">mdi-warehouse</v-icon>{item.warehouse.name}</>
                    : item.object
                      ? <><v-icon size="small" class="mr-1">mdi-office-building-outline</v-icon>{item.object.name}</>
                      : '—'
                  }
                </span>
              ),
              'item.status': ({ item }: any) => (
                <v-chip
                  size="small"
                  color={item.status === 'COMPLETED' ? 'success' : 'warning'}
                  variant="tonal"
                >
                  {item.status === 'COMPLETED' ? 'Завершена' : 'В процесі'}
                </v-chip>
              ),
              'item.startedBy': ({ item }: any) => (
                <span>{item.startedBy?.name || '—'}</span>
              ),
              'item.startedAt': ({ item }: any) => (
                <span>{formatDate(item.startedAt)}</span>
              ),
              'item.completedAt': ({ item }: any) => (
                <span>{formatDate(item.completedAt)}</span>
              ),
              'item.itemsCount': ({ item }: any) => (
                <span>{item._count?.items ?? 0}</span>
              ),
              'item.actions': ({ item }: any) => (
                <v-btn
                  icon={item.status === 'COMPLETED' ? 'mdi-file-chart-outline' : 'mdi-qrcode-scan'}
                  variant="text"
                  size="small"
                  color="primary"
                  to={`/equipment/inventory/${item.id}`}
                />
              ),
            }}
          </v-data-table>
        </v-card>

        {/* Create session dialog */}
        <v-dialog v-model={createDialog.value} max-width={450}>
          <v-card>
            <v-card-title>Нова сесія інвентаризації</v-card-title>
            <v-card-text>
              {createError.value && <v-alert type="error" variant="tonal" class="mb-3">{createError.value}</v-alert>}
              <p class="text-body-2 mb-4">Оберіть локацію для проведення інвентаризації. Система автоматично створить список обладнання, яке має бути на цій локації.</p>
              <v-select
                v-model={createForm.warehouseId}
                items={warehouses.value}
                item-value="id"
                item-title="name"
                label="Склад"
                clearable
                class="mb-3"
                disabled={!!createForm.objectId}
              />
              <v-select
                v-model={createForm.objectId}
                items={objects.value}
                item-value="id"
                item-title="name"
                label="Обʼєкт"
                clearable
                disabled={!!createForm.warehouseId}
              />
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (createDialog.value = false)}>Скасувати</v-btn>
              <v-btn
                color="primary"
                variant="elevated"
                loading={creating.value}
                disabled={!createForm.warehouseId && !createForm.objectId}
                onClick={submitCreate}
              >
                Розпочати
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
