export default defineComponent({
  name: 'PhotoReportsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Фото-звіти' })

    const { isPrivileged } = useAuth()
    const { data, refresh, pending } = useFetch('/api/photo-reports')
    const { data: objectsData } = useFetch('/api/objects')

    const reports = computed(() => (data.value as any)?.reports ?? [])
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])

    const dialog = ref(false)
    const deleteDialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const editItem = ref<any>(null)
    const deleteItem = ref<any>(null)
    const filterObjectId = ref('')

    const form = reactive({ title: '', description: '', objectId: '' })

    const filteredReports = computed(() => {
      if (!filterObjectId.value) return reports.value
      return reports.value.filter((r: any) => r.objectId === filterObjectId.value)
    })

    function openCreate() {
      editItem.value = null
      Object.assign(form, { title: '', description: '', objectId: '' })
      dialog.value = true
    }

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(form, {
        title: item.title,
        description: item.description || '',
        objectId: item.objectId,
      })
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
          await $fetch(`/api/photo-reports/${editItem.value.id}`, { method: 'PUT', body: form })
        } else {
          await $fetch('/api/photo-reports', { method: 'POST', body: form })
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
        await $fetch(`/api/photo-reports/${deleteItem.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка видалення'
      }
    }

    const headers = [
      { title: 'Назва', key: 'title' },
      { title: 'Об\'єкт', key: 'object', width: 220 },
      { title: 'Фото', key: 'photoCount', align: 'center' as const, width: 100 },
      { title: 'Автор', key: 'createdBy', width: 160 },
      { title: 'Дата', key: 'createdAt', width: 140 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 180 },
    ]

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Фото-звіти з об'єктів</div>
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
            Новий звіт
          </v-btn>
        </div>

        <v-card>
          <v-card-text class="pb-0">
            <v-row>
              <v-col cols={12} sm={4}>
                <v-autocomplete
                  v-model={filterObjectId.value}
                  label="Фільтр по об'єкту"
                  items={objects.value}
                  item-title="name"
                  item-value="id"
                  clearable
                  density="compact"
                  prepend-inner-icon="mdi-office-building-outline"
                  hide-details
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-data-table headers={headers} items={filteredReports.value} loading={pending.value} hover>
            {{
              'item.title': ({ item }: any) => (
                <nuxt-link to={`/photo-reports/${item.id}`} class="text-primary font-weight-medium text-decoration-none">
                  {item.title}
                </nuxt-link>
              ),
              'item.object': ({ item }: any) => (
                <span>{item.object?.name ?? '—'}</span>
              ),
              'item.photoCount': ({ item }: any) => (
                <v-chip size="small" color="info" variant="tonal">
                  {item._count?.photos ?? 0}
                </v-chip>
              ),
              'item.createdBy': ({ item }: any) => (
                <span>{item.createdBy?.name ?? '—'}</span>
              ),
              'item.createdAt': ({ item }: any) => (
                <span>{new Date(item.createdAt).toLocaleDateString('uk-UA')}</span>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end">
                  <v-btn icon="mdi-eye" variant="text" size="small" color="info" to={`/photo-reports/${item.id}`} title="Переглянути" />
                  <v-btn
                    icon="mdi-file-pdf-box"
                    variant="text"
                    size="small"
                    color="error"
                    title="Завантажити PDF"
                    href={`/api/photo-reports/${item.id}/pdf`}
                    target="_blank"
                  />
                  <v-btn icon="mdi-pencil" variant="text" size="small" color="primary" onClick={() => openEdit(item)} title="Редагувати" />
                  <v-btn icon="mdi-delete" variant="text" size="small" color="error" onClick={() => openDelete(item)} title="Видалити" />
                </div>
              ),
            }}
          </v-data-table>
        </v-card>

        {/* Create/Edit dialog */}
        <v-dialog v-model={dialog.value} max-width={500}>
          <v-card>
            <v-card-title>{editItem.value ? 'Редагувати фото-звіт' : 'Новий фото-звіт'}</v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-text-field v-model={form.title} label="Назва *" class="mb-3" />
              <v-autocomplete
                v-model={form.objectId}
                label="Об'єкт *"
                items={objects.value}
                item-title="name"
                item-value="id"
                prepend-inner-icon="mdi-office-building-outline"
                no-data-text="Немає об'єктів"
                class="mb-3"
              />
              <v-textarea v-model={form.description} label="Опис" rows={3} />
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (dialog.value = false)}>Скасувати</v-btn>
              <v-btn
                color="primary"
                variant="elevated"
                loading={saving.value}
                disabled={!form.title || !form.objectId}
                onClick={save}
              >
                {editItem.value ? 'Зберегти' : 'Створити'}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        {/* Delete confirmation */}
        <v-dialog v-model={deleteDialog.value} max-width={400}>
          <v-card>
            <v-card-title>Видалити фото-звіт?</v-card-title>
            <v-card-text>Фото-звіт "{deleteItem.value?.title}" та всі його фото будуть видалені.</v-card-text>
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
