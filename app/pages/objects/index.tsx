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

    const { isPrivileged } = useAuth()
    const route = useRoute()
    const filterProjectId = ref((route.query.projectId as string) || '')

    const { data, refresh, pending } = useFetch('/api/objects', {
      query: computed(() => ({
        ...(filterProjectId.value && { projectId: filterProjectId.value }),
      })),
    })
    const { data: clientsData } = useFetch('/api/clients')
    const { data: projectsData } = useFetch('/api/projects')
    const objects = computed(() => (data.value as any)?.objects ?? [])
    const clients = computed(() => (clientsData.value as any)?.clients ?? [])
    const projects = computed(() => (projectsData.value as any[]) ?? [])
    const activeProject = computed(() =>
      filterProjectId.value ? projects.value.find((p: any) => p.id === filterProjectId.value) : null
    )

    useHead(computed(() => ({
      title: activeProject.value ? `${activeProject.value.name} — Обʼєкти` : 'Будівельні обʼєкти',
    })))

    const dialog = ref(false)
    const deleteDialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const editItem = ref<any>(null)
    const deleteItem = ref<any>(null)

    const form = reactive({ name: '', address: '', description: '', status: 'ACTIVE', budget: '' as string | number, markupPercent: '' as string | number, clientVatPercent: '' as string | number, clientId: '', projectId: '' })

    const statusOptions = [
      { title: 'Активний', value: 'ACTIVE' },
      { title: 'Завершений', value: 'COMPLETED' },
      { title: 'Призупинений', value: 'SUSPENDED' },
    ]

    function openCreate() {
      editItem.value = null
      Object.assign(form, { name: '', address: '', description: '', status: 'ACTIVE', budget: '', markupPercent: '', clientVatPercent: '', clientId: '', projectId: filterProjectId.value || '' })
      dialog.value = true
    }

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(form, { name: item.name, address: item.address || '', description: item.description || '', status: item.status, budget: item.budget ?? '', markupPercent: item.markupPercent ?? '', clientVatPercent: item.clientVatPercent ?? '', clientId: item.clientId || '', projectId: item.projectId || '' })
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

    const uah = (n: number) =>
      `₴${n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    const headers = [
      { title: 'Назва', key: 'name' },
      { title: 'Проєкт', key: 'project', width: 180 },
      { title: 'Клієнт', key: 'client', width: 180 },
      { title: 'Адреса', key: 'address' },
      { title: 'Бюджет, ₴', key: 'budget', align: 'end' as const, width: 150 },
      { title: 'Націнка', key: 'markupPercent', align: 'end' as const, width: 110 },
      { title: 'ПДВ клієнту', key: 'clientVatPercent', align: 'end' as const, width: 120 },
      { title: 'Статус', key: 'status', width: 140 },
      { title: 'Дата створення', key: 'createdAt', width: 160 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 140 },
    ]

    return () => (
      <div>
        <div class="page-toolbar">
          <div>
            {activeProject.value && (
              <div class="d-flex align-center gap-2 mb-1">
                <v-btn
                  variant="text"
                  size="small"
                  prepend-icon="mdi-chevron-left"
                  onClick={() => navigateTo('/projects')}
                  class="text-medium-emphasis"
                >
                  Проєкти
                </v-btn>
              </div>
            )}
            <div class="d-flex align-center gap-2">
              {activeProject.value && (
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: activeProject.value.color, flexShrink: 0 }} />
              )}
              <div class="text-h5 font-weight-bold">
                {activeProject.value ? activeProject.value.name : 'Будівельні обʼєкти'}
              </div>
            </div>
            {activeProject.value?.description && (
              <div class="text-body-2 text-medium-emphasis mt-1">{activeProject.value.description}</div>
            )}
          </div>
          <v-spacer />
          {activeProject.value && (
            <v-btn variant="outlined" size="small" prepend-icon="mdi-checkbox-marked-circle-outline" onClick={() => navigateTo(`/projects/${activeProject.value.id}`)}>
              Завдання проєкту
            </v-btn>
          )}
          {!activeProject.value && (
            <v-autocomplete
              v-model={filterProjectId.value}
              label="Проєкт"
              items={projects.value}
              item-title="name"
              item-value="id"
              clearable
              density="compact"
              hide-details
              variant="outlined"
              style="max-width: 250px"
              prepend-inner-icon="mdi-folder-outline"
            />
          )}
          {isPrivileged.value && (
            <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
              Додати обʼєкт
            </v-btn>
          )}
        </div>

        <v-card>
          <v-data-table headers={headers} items={objects.value} loading={pending.value} hover>
            {{
              'item.project': ({ item }: any) => (
                item.project
                  ? <v-chip size="small" variant="tonal" style={{ border: `2px solid ${item.project.color}` }}>{item.project.name}</v-chip>
                  : <span class="text-medium-emphasis">—</span>
              ),
              'item.client': ({ item }: any) => (
                item.client
                  ? <span>{item.client.name}</span>
                  : <span class="text-medium-emphasis">—</span>
              ),
              'item.budget': ({ item }: any) => (
                item.budget != null
                  ? <span class="font-weight-medium">{uah(Number(item.budget))}</span>
                  : <span class="text-medium-emphasis">—</span>
              ),
              'item.markupPercent': ({ item }: any) => (
                item.markupPercent != null
                  ? <v-chip size="small" color="orange" variant="tonal">{Number(item.markupPercent)}%</v-chip>
                  : <span class="text-medium-emphasis">—</span>
              ),
              'item.clientVatPercent': ({ item }: any) => (
                item.clientVatPercent != null
                  ? <v-chip size="small" color="blue" variant="tonal">ПДВ {Number(item.clientVatPercent)}%</v-chip>
                  : <span class="text-medium-emphasis">—</span>
              ),
              'item.status': ({ item }: any) => (
                <v-chip size="small" color={STATUS_COLORS[item.status]} variant="tonal">
                  {STATUS_LABELS[item.status]}
                </v-chip>
              ),
              'item.createdAt': ({ item }: any) => (
                <span>{new Date(item.createdAt).toLocaleDateString('uk-UA')}</span>
              ),
              'item.name': ({ item }: any) => (
                <nuxt-link to={`/tasks?objectId=${item.id}`} class="text-primary text-decoration-none font-weight-medium">
                  {item.name}
                </nuxt-link>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end">
                  <v-btn icon="mdi-clipboard-list-outline" variant="text" size="small" color="primary" to={`/tasks?objectId=${item.id}`} title="Завдання" />
                  <v-btn icon="mdi-chart-bar" variant="text" size="small" color="info" to={`/reports/objects/${item.id}`} title="Репорт" />
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
            <v-card-title>{editItem.value ? 'Редагувати обʼєкт' : 'Новий обʼєкт'}</v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-text-field v-model={form.name} label="Назва *" class="mb-3" />
              <v-text-field v-model={form.address} label="Адреса" class="mb-3" />
              <v-text-field
                v-model={form.budget}
                label="Бюджет, ₴"
                type="number"
                min="0"
                step="0.01"
                class="mb-3"
                hint="Загальний бюджет обʼєкта (необовʼязково)"
                persistent-hint
              />
              <v-text-field
                v-model={form.markupPercent}
                label="Націнка, %"
                type="number"
                min="0"
                max="999"
                step="0.01"
                class="mb-3"
                prepend-inner-icon="mdi-percent"
                hint="Відсоток націнки для кошторису та акту (необовʼязково)"
                persistent-hint
              />
              <v-text-field
                v-model={form.clientVatPercent}
                label="ПДВ для клієнта, %"
                type="number"
                min="0"
                max="100"
                step="1"
                class="mb-3"
                prepend-inner-icon="mdi-bank-outline"
                hint="ПДВ у документах для клієнта: 0 = без ПДВ, 20 = 20%. Якщо не задано — береться з налаштувань"
                persistent-hint
              />
              <v-autocomplete
                v-model={form.clientId}
                label="Клієнт"
                items={clients.value}
                item-title="name"
                item-value="id"
                clearable
                prepend-inner-icon="mdi-account-tie"
                no-data-text="Немає клієнтів"
                class="mb-3"
              />
              <v-autocomplete
                v-model={form.projectId}
                label="Проєкт"
                items={projects.value}
                item-title="name"
                item-value="id"
                clearable
                prepend-inner-icon="mdi-folder-outline"
                no-data-text="Немає проєктів"
                class="mb-3"
              />
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
