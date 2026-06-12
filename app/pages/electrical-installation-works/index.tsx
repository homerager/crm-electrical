import TableExportBtn from '~/components/TableExportBtn'

/** Suggested work types — merged with the distinct types already used in the DB. */
const PRESET_TYPES = [
  'Електрощит',
  'СЕС',
  'Прокладання кабелів',
  'Системи освітлення',
  'Повітряні лінії ЛЕП',
  'Автоматика та захист',
  'Резервне живлення та АВР',
]

export default defineComponent({
  name: 'InstallationWorksPage',

  setup() {
    definePageMeta({ middleware: ['auth'], permission: 'electricalInstallationWorks.view' })
    useHead({ title: 'Монтажні роботи' })

    const toast = useToast()
    const { can } = useAuth()
    const { data, refresh, pending } = useFetch('/api/electrical-installation-works')
    const { data: objectsData } = useFetch('/api/objects')
    const { data: typesData } = useFetch('/api/electrical-installation-works/types')

    const works = computed(() => (data.value as any)?.works ?? [])
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])
    const typeOptions = computed(() => {
      const used = ((typesData.value as any)?.types ?? []) as string[]
      return [...new Set([...PRESET_TYPES, ...used])]
    })

    const dialog = ref(false)
    const deleteDialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const editItem = ref<any>(null)
    const deleteItem = ref<any>(null)
    const filterObjectId = ref('')
    const filterType = ref('')

    const form = reactive({ type: 'Електрощит', name: '', description: '', objectId: '' })

    const filteredWorks = computed(() =>
      works.value.filter(
        (w: any) =>
          (!filterObjectId.value || w.objectId === filterObjectId.value) &&
          (!filterType.value || w.type === filterType.value),
      ),
    )

    const uah = (n: number) =>
      `₴${Number(n || 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    function openCreate() {
      editItem.value = null
      Object.assign(form, {
        type: filterType.value || 'Електрощит',
        name: '',
        description: '',
        objectId: filterObjectId.value || '',
      })
      error.value = ''
      dialog.value = true
    }

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(form, {
        type: item.type,
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
          await $fetch(`/api/electrical-installation-works/${editItem.value.id}`, { method: 'PUT', body: form })
        } else {
          await $fetch('/api/electrical-installation-works', { method: 'POST', body: form })
        }
        dialog.value = false
        await refresh()
        toast.success(isEdit ? 'Роботу оновлено' : 'Роботу створено')
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
        await $fetch(`/api/electrical-installation-works/${deleteItem.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
        toast.success('Роботу видалено')
      } catch (e: any) {
        toast.error(e?.data?.statusMessage || 'Помилка видалення')
      }
    }

    const headers = [
      { title: 'Тип', key: 'type', width: 180 },
      { title: 'Назва', key: 'name' },
      { title: 'Обʼєкт', key: 'object', width: 200 },
      { title: 'Матеріалів', key: 'count', align: 'center' as const, width: 110 },
      { title: 'Сума, ₴', key: 'totalAmount', align: 'end' as const, width: 130 },
      { title: 'Автор', key: 'createdBy', width: 150 },
      { title: 'Дата', key: 'createdAt', width: 120 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 180 },
    ]

    const canCreate = computed(() => can('electricalInstallationWorks.create'))
    const canEdit = computed(() => can('electricalInstallationWorks.edit'))
    const canDelete = computed(() => can('electricalInstallationWorks.delete'))

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Монтажні роботи</div>
          <v-spacer />
          <TableExportBtn
            class="mr-2"
            filename="Монтажні роботи"
            rows={filteredWorks.value}
            columns={[
              { title: 'Тип', key: 'type' },
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
              Нова робота
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
              <v-col cols={12} sm={4}>
                <v-autocomplete
                  v-model={filterType.value}
                  label="Фільтр по типу"
                  items={typeOptions.value}
                  clearable
                  density="compact"
                  prepend-inner-icon="mdi-shape-outline"
                  hide-details
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-data-table headers={headers} items={filteredWorks.value} loading={pending.value} hover>
            {{
              'item.type': ({ item }: any) => (
                <v-chip size="small" variant="tonal" color="primary">{item.type}</v-chip>
              ),
              'item.name': ({ item }: any) => (
                <nuxt-link to={`/electrical-installation-works/${item.id}`} class="text-primary font-weight-medium text-decoration-none">
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
                  <v-btn icon="mdi-eye" variant="text" size="small" color="info" to={`/electrical-installation-works/${item.id}`} title="Переглянути" />
                  <v-btn
                    icon="mdi-file-pdf-box"
                    variant="text"
                    size="small"
                    color="error"
                    title="Завантажити PDF"
                    href={`/api/electrical-installation-works/${item.id}/pdf`}
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

        <v-dialog v-model={dialog.value} max-width={520}>
          <v-card>
            <v-card-title>{editItem.value ? 'Редагувати роботу' : 'Нова монтажна робота'}</v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-combobox
                v-model={form.type}
                label="Вид роботи *"
                items={typeOptions.value}
                prepend-inner-icon="mdi-shape-outline"
                hint="Оберіть зі списку або впишіть свій (напр. СЕС)"
                persistent-hint
                class="mb-3"
              />
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
                disabled={!form.name || !form.objectId || !form.type}
                onClick={save}
              >
                {editItem.value ? 'Зберегти' : 'Створити'}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model={deleteDialog.value} max-width={460}>
          <v-card>
            <v-card-title>Видалити роботу?</v-card-title>
            <v-card-text>
              Роботу "{deleteItem.value?.name}" ({deleteItem.value?.type}) буде видалено. Усі списані
              в неї матеріали повернуться на залишок обʼєкта.
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
