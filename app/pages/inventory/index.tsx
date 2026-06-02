export default defineComponent({
  name: 'MaterialInventorySessionsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Інвентаризація матеріалів' })

    const { isPrivileged } = useAuth()
    const toast = useToast()
    const router = useRouter()

    const { data, refresh, pending } = useFetch('/api/material-inventory')
    const sessions = computed(() => (data.value as any)?.sessions ?? [])

    const { data: warehousesData } = useFetch('/api/warehouses')
    const warehouses = computed(() => (warehousesData.value as any)?.warehouses ?? [])

    const createDialog = ref(false)
    const creating = ref(false)
    const createError = ref('')
    const createForm = reactive({ warehouseId: '' })

    function openCreate() {
      Object.assign(createForm, { warehouseId: '' })
      createError.value = ''
      createDialog.value = true
    }

    async function submitCreate() {
      creating.value = true
      createError.value = ''
      try {
        const res = await $fetch('/api/material-inventory', { method: 'POST', body: createForm }) as any
        createDialog.value = false
        toast.success('Сесію інвентаризації створено')
        router.push(`/inventory/${res.session.id}`)
      } catch (e: any) {
        createError.value = e?.data?.statusMessage || 'Помилка створення сесії'
        toast.error(createError.value)
      } finally {
        creating.value = false
      }
    }

    function formatDate(d: string | null) {
      if (!d) return '—'
      return new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    const deleteDialog = ref(false)
    const deleteTarget = ref<any>(null)
    const deleteError = ref('')

    function openDelete(item: any) {
      deleteTarget.value = item
      deleteError.value = ''
      deleteDialog.value = true
    }

    async function confirmDelete() {
      if (!deleteTarget.value) return
      deleteError.value = ''
      try {
        await $fetch(`/api/material-inventory/${deleteTarget.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
        toast.success('Сесію інвентаризації видалено')
      } catch (e: any) {
        deleteError.value = e?.data?.statusMessage || 'Помилка видалення'
        toast.error(deleteError.value)
      }
    }

    const headers = [
      { title: 'Склад', key: 'warehouse', sortable: false },
      { title: 'Статус', key: 'status', width: 140 },
      { title: 'Розпочав', key: 'startedBy', sortable: false },
      { title: 'Початок', key: 'startedAt' },
      { title: 'Завершено', key: 'completedAt' },
      { title: 'Позицій', key: 'itemsCount', width: 100 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 140 },
    ]

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Інвентаризація матеріалів</div>
          <v-spacer />
          <TableExportBtn
            class="mr-2"
            filename="Інвентаризація матеріалів"
            rows={sessions.value}
            columns={[
              { title: 'Склад', key: 'warehouse.name' },
              { title: 'Статус', key: 'status' },
              { title: 'Розпочав', key: 'startedBy.name' },
              { title: 'Початок', key: 'startedAt', format: (v) => (v ? new Date(v).toLocaleString('uk-UA') : '') },
              { title: 'Завершено', key: 'completedAt', format: (v) => (v ? new Date(v).toLocaleString('uk-UA') : '') },
              { title: 'Позицій', key: '_count.items' },
            ]}
          />
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
              'item.warehouse': ({ item }: any) => (
                <span>
                  <v-icon size="small" class="mr-1">mdi-warehouse</v-icon>
                  {item.warehouse?.name || '—'}
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
                <div class="d-flex gap-1 justify-end">
                  <v-btn
                    icon={item.status === 'COMPLETED' ? 'mdi-file-chart-outline' : 'mdi-qrcode-scan'}
                    variant="text"
                    size="small"
                    color="primary"
                    to={`/inventory/${item.id}`}
                  />
                  {isPrivileged.value && (
                    <v-btn icon="mdi-delete" variant="text" size="small" color="error" onClick={() => openDelete(item)} />
                  )}
                </div>
              ),
            }}
          </v-data-table>
        </v-card>

        {/* Delete dialog */}
        <v-dialog v-model={deleteDialog.value} max-width={420}>
          <v-card>
            <v-card-title>Видалити сесію?</v-card-title>
            <v-card-text>
              {deleteError.value
                ? <v-alert type="error" variant="tonal">{deleteError.value}</v-alert>
                : <span>Сесію інвентаризації для складу "<strong>{deleteTarget.value?.warehouse?.name}</strong>" буде видалено разом з усіма результатами.</span>
              }
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => { deleteDialog.value = false; deleteError.value = '' }}>
                {deleteError.value ? 'Закрити' : 'Скасувати'}
              </v-btn>
              {!deleteError.value && (
                <v-btn color="error" variant="elevated" onClick={confirmDelete}>Видалити</v-btn>
              )}
            </v-card-actions>
          </v-card>
        </v-dialog>

        {/* Create session dialog */}
        <v-dialog v-model={createDialog.value} max-width={450}>
          <v-card>
            <v-card-title>Нова сесія інвентаризації</v-card-title>
            <v-card-text>
              {createError.value && <v-alert type="error" variant="tonal" class="mb-3">{createError.value}</v-alert>}
              <p class="text-body-2 mb-4">Оберіть склад для проведення інвентаризації матеріалів. Система зафіксує очікувані залишки товарів на цьому складі для подальшого звірення.</p>
              <v-select
                v-model={createForm.warehouseId}
                items={warehouses.value}
                item-value="id"
                item-title="name"
                label="Склад *"
                clearable
              />
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (createDialog.value = false)}>Скасувати</v-btn>
              <v-btn
                color="primary"
                variant="elevated"
                loading={creating.value}
                disabled={!createForm.warehouseId}
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
