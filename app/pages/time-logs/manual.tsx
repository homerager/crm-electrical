const TASK_STATUS_UK: Record<string, string> = {
  TODO: 'До виконання',
  IN_PROGRESS: 'В роботі',
  REVIEW: 'На перевірці',
  DONE: 'Виконано',
  CANCELLED: 'Скасовано',
}

export default defineComponent({
  name: 'ManualTimeLogPage',
  setup() {
    definePageMeta({ middleware: ['auth', 'admin'] })
    useHead({ title: 'Облік часу' })

    const listQuery = reactive({
      userId: '' as string,
      objectId: '' as string,
      from: '' as string,
      to: '' as string,
      page: 1,
    })

    const { data: listData, pending: listPending, refresh: refreshLogs } = useFetch(
      '/api/time-logs',
      {
        query: computed(() => ({
          ...(listQuery.userId && { userId: listQuery.userId }),
          ...(listQuery.objectId && { objectId: listQuery.objectId }),
          ...(listQuery.from && { from: listQuery.from }),
          ...(listQuery.to && { to: listQuery.to }),
          page: listQuery.page,
        })),
      },
    )

    const totalPages = computed(() => {
      const total = Number((listData.value as any)?.total) || 0
      const ps = Number((listData.value as any)?.pageSize) || 30
      return Math.max(1, Math.ceil(total / ps))
    })

    const logs = computed(() => (listData.value as any)?.logs ?? [])

    const { data: usersData } = useFetch('/api/users/list')
    const users = computed(() => (usersData.value as any[]) ?? [])

    const { data: objectsData } = useFetch('/api/objects')
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])

    const form = reactive({
      userId: '' as string,
      objectId: '' as string,
      taskId: '' as string,
      hours: '' as string,
      description: '' as string,
      date: new Date().toISOString().slice(0, 10),
    })

    const syncingForm = ref(false)
    const dialogOpen = ref(false)
    const editingId = ref<string | null>(null)
    const saving = ref(false)
    const error = ref('')
    const success = ref('')
    const deleteOpen = ref(false)
    const deleteRow = ref<any>(null)
    const deleting = ref(false)

    const { data: tasksData, pending: tasksPending } = useAsyncData(
      () => `manual-time-tasks-${form.objectId || 'none'}`,
      async () => {
        if (!form.objectId) return { tasks: [] as any[] }
        return await $fetch<{ tasks: any[] }>('/api/tasks', { query: { objectId: form.objectId } })
      },
      { watch: [() => form.objectId] },
    )
    const tasks = computed(() => tasksData.value?.tasks ?? [])

    const taskItems = computed(() => [
      { value: '', title: 'Без завдання (лише обʼєкт)' },
      ...tasks.value.map((t: any) => ({
        value: t.id,
        title: t.parentId ? `↳ ${t.title}` : t.title,
      })),
    ])

    watch(
      () => form.objectId,
      () => {
        if (!syncingForm.value) form.taskId = ''
      },
    )

    function resetFormForCreate() {
      syncingForm.value = true
      editingId.value = null
      form.userId = ''
      form.objectId = ''
      form.taskId = ''
      form.hours = ''
      form.description = ''
      form.date = new Date().toISOString().slice(0, 10)
      nextTick(() => {
        syncingForm.value = false
      })
    }

    function openCreate() {
      error.value = ''
      resetFormForCreate()
      dialogOpen.value = true
    }

    function openEdit(item: any) {
      error.value = ''
      editingId.value = item.id
      syncingForm.value = true
      form.userId = item.userId
      form.objectId = item.object?.id || item.task?.objectId || ''
      form.taskId = item.taskId || ''
      form.hours = String(item.hours)
      form.description = item.description || ''
      form.date = new Date(item.date).toISOString().slice(0, 10)
      nextTick(() => {
        syncingForm.value = false
      })
      dialogOpen.value = true
    }

    async function submit() {
      saving.value = true
      error.value = ''
      try {
        const body = {
          userId: form.userId,
          objectId: form.objectId || null,
          taskId: form.taskId || null,
          hours: Number(form.hours),
          description: form.description.trim() || null,
          date: form.date || null,
        }
        if (editingId.value) {
          await $fetch(`/api/time-logs/${editingId.value}`, { method: 'PUT', body })
        }
        else {
          await $fetch('/api/time-logs', { method: 'POST', body })
        }
        success.value = editingId.value ? 'Запис оновлено' : 'Запис збережено'
        dialogOpen.value = false
        await refreshLogs()
      }
      catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
      }
      finally {
        saving.value = false
      }
    }

    async function confirmDelete() {
      if (!deleteRow.value) return
      deleting.value = true
      try {
        await $fetch(`/api/time-logs/${deleteRow.value.id}`, { method: 'DELETE' })
        deleteOpen.value = false
        deleteRow.value = null
        await refreshLogs()
        success.value = 'Запис видалено'
      }
      catch {
        success.value = ''
      }
      finally {
        deleting.value = false
      }
    }

    const canSubmit = computed(
      () =>
        !!form.userId
        && !!form.objectId
        && form.hours !== ''
        && Number(form.hours) > 0,
    )

    const tableHeaders = [
      { title: 'Дата', key: 'date', width: 110 },
      { title: 'Користувач', key: 'user.name', width: 140 },
      { title: 'Записав', key: 'createdByCol', width: 130, sortable: false },
      { title: 'Обʼєкт', key: 'objectCol', sortable: false },
      { title: 'Завдання', key: 'taskCol', sortable: false },
      { title: 'Статус', key: 'statusCol', width: 120, sortable: false },
      { title: 'Год.', key: 'hours', width: 72, align: 'end' as const },
      { title: 'Опис', key: 'description', sortable: false },
      { title: '', key: 'actions', width: 100, sortable: false, align: 'end' as const },
    ]

    function formatDate(d: string) {
      return new Date(d).toLocaleDateString('uk-UA')
    }

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Облік часу</div>
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
            Додати запис
          </v-btn>
          <v-btn variant="outlined" prepend-icon="mdi-arrow-left" to="/tasks" size="small">
            До завдань
          </v-btn>
        </div>

        <v-alert type="info" variant="tonal" class="mb-4" density="compact">
          Список усіх записів часу (завдання та ручні). Редагування та додавання доступні адміністратору та
          менеджеру. Записи без завдання одразу враховуються в зарплатному звіті та репорті обʼєкта; з
          завданням — у звітах після статусу «Виконано».
        </v-alert>

        {success.value && (
          <v-alert type="success" variant="tonal" class="mb-4" closable onClick:close={() => (success.value = '')}>
            {success.value}
          </v-alert>
        )}

        <v-card class="mb-4">
          <v-card-title class="text-subtitle-1">Фільтри</v-card-title>
          <v-card-text class="pb-2">
            <v-row dense>
              <v-col cols={12} sm={6} md={4}>
                <v-select
                  v-model={listQuery.userId}
                  label="Користувач"
                  items={[{ value: '', title: 'Усі' }, ...users.value.map((u: any) => ({ value: u.id, title: u.name }))]}
                  item-title="title"
                  item-value="value"
                  clearable
                  class="w-100"
                  density="compact"
                  variant="outlined"
                  hide-details
                  onUpdate:modelValue={() => (listQuery.page = 1)}
                />
              </v-col>
              <v-col cols={12} sm={6} md={4}>
                <v-select
                  v-model={listQuery.objectId}
                  label="Обʼєкт"
                  items={[{ value: '', title: 'Усі' }, ...objects.value.map((o: any) => ({ value: o.id, title: o.name }))]}
                  item-title="title"
                  item-value="value"
                  clearable
                  class="w-100"
                  density="compact"
                  variant="outlined"
                  hide-details
                  onUpdate:modelValue={() => (listQuery.page = 1)}
                />
              </v-col>
              <v-col cols={12} sm={6} md={2}>
                <v-text-field
                  v-model={listQuery.from}
                  label="Від"
                  type="date"
                  density="compact"
                  variant="outlined"
                  hide-details
                  class="w-100"
                  onUpdate:modelValue={() => (listQuery.page = 1)}
                />
              </v-col>
              <v-col cols={12} sm={6} md={2}>
                <v-text-field
                  v-model={listQuery.to}
                  label="До"
                  type="date"
                  density="compact"
                  variant="outlined"
                  hide-details
                  class="w-100"
                  onUpdate:modelValue={() => (listQuery.page = 1)}
                />
              </v-col>
              <v-col cols={12} class="d-flex align-center">
                <v-btn variant="tonal" prepend-icon="mdi-refresh" loading={listPending.value} onClick={() => refreshLogs()}>
                  Оновити
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card>
          <v-data-table
            headers={tableHeaders}
            items={logs.value}
            loading={listPending.value}
            items-per-page={-1}
            hide-default-footer
          >
            {{
              'item.date': ({ item }: any) => <span class="text-body-2">{formatDate(item.date)}</span>,
              'item.createdByCol': ({ item }: any) => (
                <span class="text-body-2">{item.createdBy?.name ?? '—'}</span>
              ),
              'item.objectCol': ({ item }: any) => (
                <span class="text-body-2">{item.object?.name ?? item.task?.object?.name ?? '—'}</span>
              ),
              'item.taskCol': ({ item }: any) =>
                item.task ? (
                  <span class="text-body-2">{item.task.title}</span>
                ) : (
                  <span class="text-medium-emphasis">(без завдання)</span>
                ),
              'item.statusCol': ({ item }: any) =>
                item.task ? (
                  <v-chip size="x-small" variant="tonal">{TASK_STATUS_UK[item.task.status] ?? item.task.status}</v-chip>
                ) : (
                  <span class="text-caption text-medium-emphasis">—</span>
                ),
              'item.hours': ({ item }: any) => <strong>{item.hours}г</strong>,
              'item.description': ({ item }: any) => (
                <span class="text-body-2 text-medium-emphasis text-truncate" style={{ maxWidth: '240px', display: 'inline-block' }}>
                  {item.description || '—'}
                </span>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex justify-end gap-1">
                  <v-btn icon="mdi-pencil" size="small" variant="text" color="primary" onClick={() => openEdit(item)} />
                  <v-btn
                    icon="mdi-delete"
                    size="small"
                    variant="text"
                    color="error"
                    onClick={() => {
                      deleteRow.value = item
                      deleteOpen.value = true
                    }}
                  />
                </div>
              ),
            }}
          </v-data-table>
          <v-divider />
          <div class="d-flex align-center justify-center pa-3 gap-2 flex-wrap">
            <v-pagination
              v-model={listQuery.page}
              length={totalPages.value}
              total-visible={7}
              size="small"
              disabled={listPending.value}
            />
            <span class="text-caption text-medium-emphasis">
              Всього: {(listData.value as any)?.total ?? 0}
            </span>
          </div>
        </v-card>

        <v-dialog v-model={dialogOpen.value} max-width={520} persistent={false}>
          <v-card>
            <v-card-title class="pa-4">
              {editingId.value ? 'Редагувати запис часу' : 'Новий запис часу'}
            </v-card-title>
            <v-card-text class="pa-4 pt-0">
              {error.value && (
                <v-alert type="error" variant="tonal" class="mb-3" closable onClick:close={() => (error.value = '')}>
                  {error.value}
                </v-alert>
              )}
              {form.objectId && (
                <v-alert type="info" variant="tonal" density="compact" class="mb-3">
                  Години зараховуються на обраного користувача нижче.
                </v-alert>
              )}

              <v-select
                v-model={form.userId}
                label="Користувач *"
                items={users.value.map((u: any) => ({ value: u.id, title: u.name }))}
                item-title="title"
                item-value="value"
                class="mb-3"
                hide-details="auto"
              />

              <v-select
                v-model={form.objectId}
                label="Обʼєкт *"
                items={objects.value.map((o: any) => ({ value: o.id, title: o.name }))}
                item-title="title"
                item-value="value"
                class="mb-3"
                hide-details="auto"
              />

              <v-select
                v-model={form.taskId}
                label="Завдання (необовʼязково)"
                items={taskItems.value}
                item-title="title"
                item-value="value"
                disabled={!form.objectId}
                loading={tasksPending.value}
                hint={form.objectId ? 'Усі завдання та підзавдання на обраному обʼєкті' : 'Спочатку оберіть обʼєкт'}
                persistent-hint
                class="mb-3"
              />

              <v-text-field
                v-model={form.hours}
                label="Години *"
                type="number"
                min="0.25"
                step="0.25"
                class="mb-3"
                hide-details="auto"
              />

              <v-text-field v-model={form.date} label="Дата" type="date" class="mb-3" hide-details="auto" />

              <v-textarea v-model={form.description} label="Опис" rows={3} hide-details="auto" />
            </v-card-text>
            <v-card-actions class="px-4 pb-4">
              <v-btn variant="outlined" onClick={() => (dialogOpen.value = false)}>Скасувати</v-btn>
              <v-spacer />
              <v-btn
                color="primary"
                variant="elevated"
                loading={saving.value}
                disabled={!canSubmit.value}
                onClick={submit}
              >
                Зберегти
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model={deleteOpen.value} max-width={400}>
          {deleteRow.value && (
            <v-card>
              <v-card-title>Видалити запис?</v-card-title>
              <v-card-text>
                {formatDate(deleteRow.value.date)} · {deleteRow.value.user?.name} · {deleteRow.value.hours}г
              </v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn
                  variant="text"
                  onClick={() => {
                    deleteOpen.value = false
                    deleteRow.value = null
                  }}
                >
                  Ні
                </v-btn>
                <v-btn color="error" variant="elevated" loading={deleting.value} onClick={confirmDelete}>
                  Видалити
                </v-btn>
              </v-card-actions>
            </v-card>
          )}
        </v-dialog>
      </div>
    )
  },
})
