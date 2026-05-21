const STATUS_OPTIONS = [
  { value: '', title: 'Всі статуси' },
  { value: 'IN_STOCK', title: 'На складі' },
  { value: 'INSTALLED', title: 'Встановлено' },
  { value: 'IN_REPAIR', title: 'На ремонті' },
  { value: 'DECOMMISSIONED', title: 'Списано' },
  { value: 'IN_TRANSIT', title: 'В дорозі' },
]

const STATUS_COLORS: Record<string, string> = {
  IN_STOCK: 'success',
  INSTALLED: 'primary',
  IN_REPAIR: 'warning',
  DECOMMISSIONED: 'grey',
  IN_TRANSIT: 'info',
}

const STATUS_LABELS: Record<string, string> = {
  IN_STOCK: 'На складі',
  INSTALLED: 'Встановлено',
  IN_REPAIR: 'На ремонті',
  DECOMMISSIONED: 'Списано',
  IN_TRANSIT: 'В дорозі',
}

export default defineComponent({
  name: 'EquipmentListPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Обладнання' })

    const { isPrivileged } = useAuth()
    const toast = useToast()
    const router = useRouter()

    const filterStatus = ref('')
    const filterWarehouseId = ref('')
    const filterObjectId = ref('')
    const search = ref('')

    const { data: warehousesData } = useFetch('/api/warehouses')
    const { data: objectsData } = useFetch('/api/objects')
    const warehouses = computed(() => (warehousesData.value as any)?.warehouses ?? [])
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])

    const { data, refresh, pending } = useFetch('/api/equipment', {
      query: computed(() => ({
        ...(filterStatus.value && { status: filterStatus.value }),
        ...(filterWarehouseId.value && { warehouseId: filterWarehouseId.value }),
        ...(filterObjectId.value && { objectId: filterObjectId.value }),
        ...(search.value && { search: search.value }),
      })),
    })
    const equipment = computed(() => (data.value as any)?.equipment ?? [])

    const dialog = ref(false)
    const editItem = ref<any>(null)
    const saving = ref(false)
    const error = ref('')

    const form = reactive({
      name: '',
      model: '',
      serialNumber: '',
      barcode: '',
      currentWarehouseId: '',
      currentObjectId: '',
      responsibleUserId: '',
    })

    const { data: usersData } = useFetch('/api/users/list')
    const users = computed(() => {
      const v = usersData.value as any
      return Array.isArray(v) ? v : v?.users ?? []
    })

    function openCreate() {
      editItem.value = null
      Object.assign(form, { name: '', model: '', serialNumber: '', barcode: '', currentWarehouseId: '', currentObjectId: '', responsibleUserId: '' })
      error.value = ''
      dialog.value = true
    }

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(form, {
        name: item.name || '',
        model: item.model || '',
        serialNumber: item.serialNumber || '',
        barcode: item.barcode || '',
        currentWarehouseId: item.currentWarehouseId || '',
        currentObjectId: item.currentObjectId || '',
        responsibleUserId: item.responsibleUserId || '',
      })
      error.value = ''
      dialog.value = true
    }

    async function save() {
      saving.value = true
      error.value = ''
      const isEdit = !!editItem.value
      try {
        if (editItem.value) {
          await $fetch(`/api/equipment/${editItem.value.id}`, { method: 'PUT', body: form })
        } else {
          await $fetch('/api/equipment', { method: 'POST', body: form })
        }
        dialog.value = false
        await refresh()
        toast.success(isEdit ? 'Обладнання оновлено' : 'Обладнання створено')
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
        toast.error(error.value)
      } finally {
        saving.value = false
      }
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
        await $fetch(`/api/equipment/${deleteTarget.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
        toast.success('Обладнання видалено')
      } catch (e: any) {
        deleteError.value = e?.data?.statusMessage || 'Помилка видалення'
        toast.error(deleteError.value)
      }
    }

    const headers = [
      { title: 'Назва', key: 'name' },
      { title: 'Модель', key: 'model' },
      { title: 'Серійний №', key: 'serialNumber' },
      { title: 'Статус', key: 'status', width: 150 },
      { title: 'Місцезнаходження', key: 'location', sortable: false },
      { title: 'Відповідальний', key: 'responsibleUser', sortable: false },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 140 },
    ]

    function locationText(item: any) {
      if (item.currentWarehouse) return item.currentWarehouse.name
      if (item.currentObject) return item.currentObject.name
      return '—'
    }

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Обладнання</div>
          <v-spacer />
          <v-btn variant="outlined" prepend-icon="mdi-qrcode-scan" class="mr-2" to="/equipment/scan">
            Сканувати
          </v-btn>
          <v-btn variant="outlined" prepend-icon="mdi-printer" class="mr-2" to="/equipment/print">
            Друк QR
          </v-btn>
          {isPrivileged.value && (
            <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
              Додати
            </v-btn>
          )}
        </div>

        <v-card class="mb-4">
          <v-card-text>
            <v-row dense>
              <v-col cols={12} sm={3}>
                <v-text-field
                  v-model={search.value}
                  label="Пошук"
                  prepend-inner-icon="mdi-magnify"
                  clearable
                  hide-details
                  density="compact"
                />
              </v-col>
              <v-col cols={12} sm={3}>
                <v-select
                  v-model={filterStatus.value}
                  items={STATUS_OPTIONS}
                  item-value="value"
                  item-title="title"
                  label="Статус"
                  hide-details
                  density="compact"
                  clearable
                />
              </v-col>
              <v-col cols={12} sm={3}>
                <v-select
                  v-model={filterWarehouseId.value}
                  items={warehouses.value}
                  item-value="id"
                  item-title="name"
                  label="Склад"
                  hide-details
                  density="compact"
                  clearable
                />
              </v-col>
              <v-col cols={12} sm={3}>
                <v-select
                  v-model={filterObjectId.value}
                  items={objects.value}
                  item-value="id"
                  item-title="name"
                  label="Обʼєкт"
                  hide-details
                  density="compact"
                  clearable
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card>
          <v-data-table
            headers={headers}
            items={equipment.value}
            loading={pending.value}
            hover
            items-per-page={25}
            onClick:row={(_e: any, { item }: any) => router.push(`/equipment/${item.id}`)}
          >
            {{
              'item.status': ({ item }: any) => (
                <v-chip size="small" color={STATUS_COLORS[item.status] || 'default'} variant="tonal">
                  {STATUS_LABELS[item.status] || item.status}
                </v-chip>
              ),
              'item.location': ({ item }: any) => (
                <span>{locationText(item)}</span>
              ),
              'item.responsibleUser': ({ item }: any) => (
                <span>{item.responsibleUser?.name || '—'}</span>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end" onClick={(e: Event) => e.stopPropagation()}>
                  <v-btn icon="mdi-eye" variant="text" size="small" to={`/equipment/${item.id}`} />
                  {isPrivileged.value && (
                    <>
                      <v-btn icon="mdi-pencil" variant="text" size="small" color="primary" onClick={() => openEdit(item)} />
                      <v-btn icon="mdi-delete" variant="text" size="small" color="error" onClick={() => openDelete(item)} />
                    </>
                  )}
                </div>
              ),
            }}
          </v-data-table>
        </v-card>

        {/* Create/Edit dialog */}
        <v-dialog v-model={dialog.value} max-width={600}>
          <v-card>
            <v-card-title>{editItem.value ? 'Редагувати обладнання' : 'Нове обладнання'}</v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-text-field v-model={form.name} label="Назва *" class="mb-3" />
              <v-text-field v-model={form.model} label="Модель" class="mb-3" />
              <v-text-field v-model={form.serialNumber} label="Серійний номер" class="mb-3" />
              <v-text-field v-model={form.barcode} label="Штрих-код (заводський)" class="mb-3" />
              <v-select
                v-model={form.currentWarehouseId}
                items={warehouses.value}
                item-value="id"
                item-title="name"
                label="Склад"
                clearable
                class="mb-3"
              />
              <v-select
                v-model={form.currentObjectId}
                items={objects.value}
                item-value="id"
                item-title="name"
                label="Обʼєкт"
                clearable
                class="mb-3"
              />
              <v-select
                v-model={form.responsibleUserId}
                items={users.value}
                item-value="id"
                item-title="name"
                label="Відповідальний"
                clearable
              />
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (dialog.value = false)}>Скасувати</v-btn>
              <v-btn color="primary" variant="elevated" loading={saving.value} disabled={!form.name} onClick={save}>
                {editItem.value ? 'Зберегти' : 'Створити'}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        {/* Delete dialog */}
        <v-dialog v-model={deleteDialog.value} max-width={420}>
          <v-card>
            <v-card-title>Видалити обладнання?</v-card-title>
            <v-card-text>
              {deleteError.value
                ? <v-alert type="error" variant="tonal">{deleteError.value}</v-alert>
                : <span>Обладнання "<strong>{deleteTarget.value?.name}</strong>" буде видалено.</span>
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
      </div>
    )
  },
})
