import TableExportBtn from '~/components/TableExportBtn'

export default defineComponent({
  name: 'ElectricalPanelsPage',

  setup() {
    definePageMeta({ middleware: ['auth'], permission: 'electricalPanels.view' })
    useHead({ title: 'Електрощити' })

    const toast = useToast()
    const { can } = useAuth()
    const { data, refresh, pending } = useFetch('/api/electrical-panels')
    const { data: objectsData } = useFetch('/api/objects')

    const panels = computed(() => (data.value as any)?.panels ?? [])
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])

    const dialog = ref(false)
    const deleteDialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const editItem = ref<any>(null)
    const deleteItem = ref<any>(null)
    const filterObjectId = ref('')

    const form = reactive({ name: '', description: '', objectId: '' })

    const filteredPanels = computed(() => {
      if (!filterObjectId.value) return panels.value
      return panels.value.filter((p: any) => p.objectId === filterObjectId.value)
    })

    const uah = (n: number) =>
      `₴${Number(n || 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    function openCreate() {
      editItem.value = null
      Object.assign(form, { name: '', description: '', objectId: filterObjectId.value || '' })
      error.value = ''
      dialog.value = true
    }

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(form, {
        name: item.name,
        description: item.description || '',
        objectId: item.objectId,
      })
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
      const isEdit = !!editItem.value
      try {
        if (editItem.value) {
          await $fetch(`/api/electrical-panels/${editItem.value.id}`, { method: 'PUT', body: form })
        } else {
          await $fetch('/api/electrical-panels', { method: 'POST', body: form })
        }
        dialog.value = false
        await refresh()
        toast.success(isEdit ? 'Електрощит оновлено' : 'Електрощит створено')
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
        toast.error(error.value)
      } finally {
        saving.value = false
      }
    }

    async function confirmDelete() {
      if (!deleteItem.value) return
      try {
        await $fetch(`/api/electrical-panels/${deleteItem.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
        toast.success('Електрощит видалено')
      } catch (e: any) {
        toast.error(e?.data?.statusMessage || 'Помилка видалення')
      }
    }

    const headers = [
      { title: 'Назва', key: 'name' },
      { title: 'Обʼєкт', key: 'object', width: 220 },
      { title: 'Матеріалів', key: 'count', align: 'center' as const, width: 120 },
      { title: 'Сума, ₴', key: 'totalAmount', align: 'end' as const, width: 140 },
      { title: 'Автор', key: 'createdBy', width: 160 },
      { title: 'Дата', key: 'createdAt', width: 130 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 180 },
    ]

    const canCreate = computed(() => can('electricalPanels.create'))
    const canEdit = computed(() => can('electricalPanels.edit'))
    const canDelete = computed(() => can('electricalPanels.delete'))

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Електрощити</div>
          <v-spacer />
          <TableExportBtn
            class="mr-2"
            filename="Електрощити"
            rows={filteredPanels.value}
            columns={[
              { title: 'Назва', key: 'name' },
              { title: 'Обʼєкт', key: 'object.name' },
              { title: 'Матеріалів', key: '_count.materials' },
              { title: 'Сума', key: 'totalAmount' },
              { title: 'Автор', key: 'createdBy.name' },
              { title: 'Дата', key: 'createdAt', format: (v) => (v ? new Date(v).toLocaleDateString('uk-UA') : '') },
            ]}
          />
          {canCreate.value && (
            <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
              Новий щит
            </v-btn>
          )}
        </div>

        <v-card>
          <v-card-text class="pb-0">
            <v-row>
              <v-col cols={12} sm={4}>
                <v-autocomplete
                  v-model={filterObjectId.value}
                  label="Фільтр по обʼєкту"
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

          <v-data-table headers={headers} items={filteredPanels.value} loading={pending.value} hover>
            {{
              'item.name': ({ item }: any) => (
                <nuxt-link to={`/electrical-panels/${item.id}`} class="text-primary font-weight-medium text-decoration-none">
                  {item.name}
                </nuxt-link>
              ),
              'item.object': ({ item }: any) => <span>{item.object?.name ?? '—'}</span>,
              'item.count': ({ item }: any) => (
                <v-chip size="small" color="info" variant="tonal">{item._count?.materials ?? 0}</v-chip>
              ),
              'item.totalAmount': ({ item }: any) => <strong>{uah(item.totalAmount)}</strong>,
              'item.createdBy': ({ item }: any) => <span>{item.createdBy?.name ?? '—'}</span>,
              'item.createdAt': ({ item }: any) => (
                <span>{new Date(item.createdAt).toLocaleDateString('uk-UA')}</span>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end">
                  <v-btn icon="mdi-eye" variant="text" size="small" color="info" to={`/electrical-panels/${item.id}`} title="Переглянути" />
                  <v-btn
                    icon="mdi-file-pdf-box"
                    variant="text"
                    size="small"
                    color="error"
                    title="Завантажити PDF"
                    href={`/api/electrical-panels/${item.id}/pdf`}
                    target="_blank"
                  />
                  {canEdit.value && (
                    <v-btn icon="mdi-pencil" variant="text" size="small" color="primary" onClick={() => openEdit(item)} title="Редагувати" />
                  )}
                  {canDelete.value && (
                    <v-btn icon="mdi-delete" variant="text" size="small" color="error" onClick={() => openDelete(item)} title="Видалити" />
                  )}
                </div>
              ),
            }}
          </v-data-table>
        </v-card>

        <v-dialog v-model={dialog.value} max-width={500}>
          <v-card>
            <v-card-title>{editItem.value ? 'Редагувати електрощит' : 'Новий електрощит'}</v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-text-field v-model={form.name} label="Назва / маркування *" class="mb-3" />
              <v-autocomplete
                v-model={form.objectId}
                label="Обʼєкт *"
                items={objects.value}
                item-title="name"
                item-value="id"
                prepend-inner-icon="mdi-office-building-outline"
                no-data-text="Немає обʼєктів"
                disabled={!!editItem.value}
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
                disabled={!form.name || !form.objectId}
                onClick={save}
              >
                {editItem.value ? 'Зберегти' : 'Створити'}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model={deleteDialog.value} max-width={440}>
          <v-card>
            <v-card-title>Видалити електрощит?</v-card-title>
            <v-card-text>
              Електрощит "{deleteItem.value?.name}" буде видалено. Усі списані в нього матеріали
              повернуться на залишок обʼєкта.
            </v-card-text>
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
