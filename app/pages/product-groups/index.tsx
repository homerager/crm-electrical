export default defineComponent({
  name: 'ProductGroupsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({
      title: 'Групи товарів'
    })

    const { isAdmin } = useAuth()
    const { data, refresh, pending } = useFetch('/api/product-groups')
    const groups = computed(() => (data.value as any)?.groups ?? [])

    const dialog = ref(false)
    const deleteDialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const editItem = ref<any>(null)
    const deleteItem = ref<any>(null)

    const form = reactive({ name: '', description: '' })

    function openCreate() {
      editItem.value = null
      Object.assign(form, { name: '', description: '' })
      error.value = ''
      dialog.value = true
    }

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(form, { name: item.name, description: item.description || '' })
      error.value = ''
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
          await $fetch(`/api/product-groups/${editItem.value.id}`, { method: 'PUT', body: form })
        } else {
          await $fetch('/api/product-groups', { method: 'POST', body: form })
        }
        dialog.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        saving.value = false
      }
    }

    const deleteError = ref('')
    async function confirmDelete() {
      if (!deleteItem.value) return
      deleteError.value = ''
      try {
        await $fetch(`/api/product-groups/${deleteItem.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
      } catch (e: any) {
        deleteError.value = e?.data?.statusMessage || 'Помилка видалення'
      }
    }

    const headers = [
      { title: 'Назва', key: 'name' },
      { title: 'Опис', key: 'description' },
      { title: 'Товарів', key: 'count', sortable: false, width: 120 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 100 },
    ]

    return () => (
      <div>
        <div class="d-flex align-center mb-4">
          <div class="text-h5 font-weight-bold">Групи товарів</div>
          <v-spacer />
          {isAdmin.value && (
            <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
              Додати групу
            </v-btn>
          )}
        </div>

        <v-card>
          <v-data-table headers={headers} items={groups.value} loading={pending.value} hover>
            {{
              'item.description': ({ item }: any) => (
                <span class="text-medium-emphasis">{item.description || '—'}</span>
              ),
              'item.count': ({ item }: any) => (
                <v-chip size="small" color="primary" variant="tonal">
                  {item._count?.products ?? 0}
                </v-chip>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end">
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

        <v-dialog v-model={dialog.value} max-width={480}>
          <v-card>
            <v-card-title>{editItem.value ? 'Редагувати групу' : 'Нова група товарів'}</v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-text-field v-model={form.name} label="Назва *" class="mb-3" />
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
            <v-card-title>Видалити групу?</v-card-title>
            <v-card-text>
              {deleteError.value
                ? <v-alert type="error" variant="tonal">{deleteError.value}</v-alert>
                : <span>Групу "<strong>{deleteItem.value?.name}</strong>" буде видалено.</span>
              }
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => { deleteDialog.value = false; deleteError.value = '' }}>Скасувати</v-btn>
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
