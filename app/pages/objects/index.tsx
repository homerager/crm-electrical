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

export default defineComponent({
  name: 'ObjectsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({
      title: 'Будівельні обʼєкти'
    })

    const { isAdmin } = useAuth()
    const { data, refresh, pending } = useFetch('/api/objects')
    const objects = computed(() => (data.value as any)?.objects ?? [])

    const dialog = ref(false)
    const deleteDialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const editItem = ref<any>(null)
    const deleteItem = ref<any>(null)

    const form = reactive({ name: '', address: '', description: '', status: 'ACTIVE' })

    const statusOptions = [
      { title: 'Активний', value: 'ACTIVE' },
      { title: 'Завершений', value: 'COMPLETED' },
      { title: 'Призупинений', value: 'SUSPENDED' },
    ]

    function openCreate() {
      editItem.value = null
      Object.assign(form, { name: '', address: '', description: '', status: 'ACTIVE' })
      dialog.value = true
    }

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(form, { name: item.name, address: item.address || '', description: item.description || '', status: item.status })
      dialog.value = true
    }

    function openDelete(item: any) {
      deleteItem.value = item
      deleteDialog.value = true
    }

    async function save() {
      saving.value = true
      error.value = ''
      try {
        if (editItem.value) {
          await $fetch(`/api/objects/${editItem.value.id}`, { method: 'PUT', body: form })
        } else {
          await $fetch('/api/objects', { method: 'POST', body: form })
        }
        dialog.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        saving.value = false
      }
    }

    async function confirmDelete() {
      if (!deleteItem.value) return
      try {
        await $fetch(`/api/objects/${deleteItem.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка видалення'
      }
    }

    const headers = [
      { title: 'Назва', key: 'name' },
      { title: 'Адреса', key: 'address' },
      { title: 'Статус', key: 'status', width: 140 },
      { title: 'Дата створення', key: 'createdAt', width: 160 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 140 },
    ]

    return () => (
      <div>
        <div class="d-flex align-center mb-4">
          <div class="text-h5 font-weight-bold">Будівельні обʼєкти</div>
          <v-spacer />
          {isAdmin.value && (
            <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
              Додати обʼєкт
            </v-btn>
          )}
        </div>

        <v-card>
          <v-data-table headers={headers} items={objects.value} loading={pending.value} hover>
            {{
              'item.status': ({ item }: any) => (
                <v-chip size="small" color={STATUS_COLORS[item.status]} variant="tonal">
                  {STATUS_LABELS[item.status]}
                </v-chip>
              ),
              'item.createdAt': ({ item }: any) => (
                <span>{new Date(item.createdAt).toLocaleDateString('uk-UA')}</span>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end">
                  <v-btn icon="mdi-chart-bar" variant="text" size="small" color="info" to={`/reports/objects/${item.id}`} title="Репорт" />
                  {isAdmin.value && (
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

        <v-dialog v-model={dialog.value} max-width={500}>
          <v-card>
            <v-card-title>{editItem.value ? 'Редагувати обʼєкт' : 'Новий обʼєкт'}</v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-text-field v-model={form.name} label="Назва *" class="mb-3" />
              <v-text-field v-model={form.address} label="Адреса" class="mb-3" />
              <v-select v-model={form.status} label="Статус" items={statusOptions} item-title="title" item-value="value" class="mb-3" />
              <v-textarea v-model={form.description} label="Опис" rows={3} />
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

        <v-dialog v-model={deleteDialog.value} max-width={400}>
          <v-card>
            <v-card-title>Видалити обʼєкт?</v-card-title>
            <v-card-text>Обʼєкт "{deleteItem.value?.name}" буде видалено.</v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (deleteDialog.value = false)}>Скасувати</v-btn>
              <v-btn color="error" variant="elevated" onClick={confirmDelete}>Видалити</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
