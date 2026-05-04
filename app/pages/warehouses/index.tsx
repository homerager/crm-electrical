export default defineComponent({
  name: 'WarehousesPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({
      title: 'Склади'
    })

    const { isPrivileged } = useAuth()
    const { data, refresh, pending } = useFetch('/api/warehouses', { query: { includeInactive: 'true' } })
    const warehouses = computed(() => (data.value as any)?.warehouses ?? [])

    const dialog = ref(false)
    const deleteDialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const deleteError = ref('')
    const editItem = ref<any>(null)
    const deleteItem = ref<any>(null)

    const form = reactive({ name: '', address: '', description: '' })

    function openCreate() {
      editItem.value = null
      Object.assign(form, { name: '', address: '', description: '' })
      dialog.value = true
    }

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(form, { name: item.name, address: item.address || '', description: item.description || '' })
      dialog.value = true
    }

    function openDelete(item: any) {
      deleteItem.value = item
      deleteError.value = ''
      deleteDialog.value = true
    }

    async function save() {
      saving.value = true
      error.value = ''
      try {
        if (editItem.value) {
          await $fetch(`/api/warehouses/${editItem.value.id}`, { method: 'PUT', body: form })
        } else {
          await $fetch('/api/warehouses', { method: 'POST', body: form })
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
      deleteError.value = ''
      try {
        await $fetch(`/api/warehouses/${deleteItem.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
      } catch (e: any) {
        deleteError.value = e?.data?.statusMessage || 'Помилка видалення'
      }
    }

    const headers = [
      { title: 'Назва', key: 'name' },
      { title: 'Адреса', key: 'address' },
      { title: 'Опис', key: 'description' },
      { title: 'Статус', key: 'isActive', width: 120 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 120 },
    ]

    return () => (
      <div>
        <div class="d-flex align-center mb-4">
          <div class="text-h5 font-weight-bold">Склади</div>
          <v-spacer />
          {isPrivileged.value && (
            <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
              Додати склад
            </v-btn>
          )}
        </div>

        <v-card>
          <v-data-table
            headers={headers}
            items={warehouses.value}
            loading={pending.value}
            hover
          >
            {{
              'item.isActive': ({ item }: any) => (
                <v-chip size="small" color={item.isActive ? 'success' : 'default'} variant="tonal">
                  {item.isActive ? 'Активний' : 'Неактивний'}
                </v-chip>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end">
                  <v-btn icon="mdi-eye" variant="text" size="small" to={`/warehouses/${item.id}`} />
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

        <v-dialog v-model={dialog.value} max-width={500}>
          <v-card>
            <v-card-title>{editItem.value ? 'Редагувати склад' : 'Новий склад'}</v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-text-field v-model={form.name} label="Назва *" class="mb-3" />
              <v-text-field v-model={form.address} label="Адреса" class="mb-3" />
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

        <v-dialog v-model={deleteDialog.value} max-width={420}>
          <v-card>
            <v-card-title>Видалити склад?</v-card-title>
            <v-card-text>
              {deleteError.value
                ? <v-alert type="error" variant="tonal">{deleteError.value}</v-alert>
                : <span>Склад "<strong>{deleteItem.value?.name}</strong>" буде видалено.</span>
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
