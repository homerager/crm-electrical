export default defineComponent({
  name: 'JobTitlesPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Посади' })

    const { isAdmin } = useAuth()
    const router = useRouter()

    if (!isAdmin.value) {
      router.push('/')
    }

    const { data, refresh, pending } = useFetch('/api/job-titles')
    const jobTitles = computed(() => (data.value as any)?.jobTitles ?? [])

    const dialog = ref(false)
    const deleteDialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const editItem = ref<any>(null)
    const deleteItem = ref<any>(null)

    const form = reactive({ name: '', sortOrder: 0 })

    function openCreate() {
      editItem.value = null
      Object.assign(form, { name: '', sortOrder: 0 })
      error.value = ''
      dialog.value = true
    }

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(form, { name: item.name, sortOrder: item.sortOrder ?? 0 })
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
          await $fetch(`/api/job-titles/${editItem.value.id}`, {
            method: 'PUT',
            body: { name: form.name, sortOrder: Number(form.sortOrder) || 0 },
          })
        } else {
          await $fetch('/api/job-titles', {
            method: 'POST',
            body: { name: form.name, sortOrder: Number(form.sortOrder) || 0 },
          })
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
        await $fetch(`/api/job-titles/${deleteItem.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
      } catch (e: any) {
        deleteError.value = e?.data?.statusMessage || 'Помилка видалення'
      }
    }

    const headers = [
      { title: 'Назва', key: 'name' },
      { title: 'Порядок', key: 'sortOrder', width: 110 },
      { title: 'Співробітників', key: 'count', sortable: false, width: 140 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 100 },
    ]

    return () => (
      <div>
        <div class="d-flex align-center mb-4">
          <div class="title-container">
            <h1 class="text-h5 font-weight-bold">Посади</h1>
            <div class="text-caption text-medium-emphasis">Довідник посад для користувачів CRM</div>
          </div>
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
            Додати посаду
          </v-btn>
        </div>

        <v-card>
          <v-data-table headers={headers} items={jobTitles.value} loading={pending.value} hover>
            {{
              'item.sortOrder': ({ item }: any) => (
                <span class="text-medium-emphasis">{item.sortOrder ?? 0}</span>
              ),
              'item.count': ({ item }: any) => (
                <v-chip size="small" color="primary" variant="tonal">
                  {item._count?.users ?? 0}
                </v-chip>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end">
                  <v-btn icon="mdi-pencil" variant="text" size="small" color="primary" onClick={() => openEdit(item)} />
                  <v-btn icon="mdi-delete" variant="text" size="small" color="error" onClick={() => openDelete(item)} />
                </div>
              ),
            }}
          </v-data-table>
        </v-card>

        <v-dialog v-model={dialog.value} max-width={480}>
          <v-card>
            <v-card-title class="pa-4">{editItem.value ? 'Редагувати посаду' : 'Нова посада'}</v-card-title>
            <v-card-text class="pa-4 pt-0">
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-text-field v-model={form.name} label="Назва посади *" class="mb-3" variant="outlined" density="compact" />
              <v-text-field
                v-model={form.sortOrder}
                label="Порядок сортування"
                type="number"
                hint="Менше число — вище у списках"
                persistent-hint
                variant="outlined"
                density="compact"
              />
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (dialog.value = false)}>Скасувати</v-btn>
              <v-btn color="primary" variant="elevated" loading={saving.value} disabled={!form.name?.trim()} onClick={save}>
                {editItem.value ? 'Зберегти' : 'Створити'}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model={deleteDialog.value} max-width={420}>
          <v-card>
            <v-card-title class="pa-4">Видалити посаду?</v-card-title>
            <v-card-text class="pa-4 pt-0">
              {deleteError.value
                ? <v-alert type="error" variant="tonal">{deleteError.value}</v-alert>
                : (
                  <span>
                    Посаду «<strong>{deleteItem.value?.name}</strong>» буде видалено. У користувачів поле посади стане порожнім.
                  </span>
                  )}
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
