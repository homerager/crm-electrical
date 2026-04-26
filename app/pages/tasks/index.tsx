const STATUSES = [
  { value: 'TODO', label: 'До виконання', color: 'blue-grey', icon: 'mdi-circle-outline' },
  { value: 'IN_PROGRESS', label: 'В роботі', color: 'blue', icon: 'mdi-progress-clock' },
  { value: 'REVIEW', label: 'На перевірці', color: 'orange', icon: 'mdi-eye-check-outline' },
  { value: 'DONE', label: 'Виконано', color: 'success', icon: 'mdi-check-circle-outline' },
  { value: 'CANCELLED', label: 'Скасовано', color: 'error', icon: 'mdi-close-circle-outline' },
]

const PRIORITIES = [
  { value: 'LOW', label: 'Низький', color: 'success', icon: 'mdi-arrow-down' },
  { value: 'MEDIUM', label: 'Середній', color: 'warning', icon: 'mdi-minus' },
  { value: 'HIGH', label: 'Високий', color: 'orange', icon: 'mdi-arrow-up' },
  { value: 'URGENT', label: 'Терміново', color: 'error', icon: 'mdi-alert' },
]

function statusMeta(val: string) {
  return STATUSES.find((s) => s.value === val) ?? STATUSES[0]
}
function priorityMeta(val: string) {
  return PRIORITIES.find((p) => p.value === val) ?? PRIORITIES[1]
}

export default defineComponent({
  name: 'TasksPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Завдання' })

    const { isAdmin } = useAuth()

    const viewMode = ref<'kanban' | 'list'>('kanban')
    const filterStatus = ref('')
    const filterPriority = ref('')
    const filterAssignee = ref('')

    const dialog = ref(false)
    const deleteDialog = ref(false)
    const saving = ref(false)
    const deleting = ref(false)
    const error = ref('')
    const deleteTarget = ref<any>(null)

    // Drag & drop state
    const dragTaskId = ref<string | null>(null)
    const dragOverStatus = ref<string | null>(null)

    const form = reactive({
      title: '',
      description: '',
      priority: 'MEDIUM',
      assignedToId: '',
      objectId: '',
      dueDate: '',
      estimatedHours: '',
    })

    const { data: tasksData, refresh, pending } = useFetch('/api/tasks', {
      query: computed(() => ({
        ...(filterStatus.value && { status: filterStatus.value }),
        ...(filterPriority.value && { priority: filterPriority.value }),
        ...(filterAssignee.value && { assignedToId: filterAssignee.value }),
      })),
    })

    const { data: usersData } = useFetch('/api/users')
    const { data: objectsData } = useFetch('/api/objects')

    const tasks = computed(() => (tasksData.value as any)?.tasks ?? [])
    const users = computed(() => (usersData.value as any)?.users ?? [])
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])

    const tasksByStatus = computed(() => {
      const map: Record<string, any[]> = {}
      for (const s of STATUSES) map[s.value] = []
      for (const t of tasks.value) {
        if (map[t.status]) map[t.status].push(t)
      }
      return map
    })

    function openCreate() {
      Object.assign(form, {
        title: '', description: '', priority: 'MEDIUM',
        assignedToId: '', objectId: '', dueDate: '', estimatedHours: '',
      })
      error.value = ''
      dialog.value = true
    }

    async function save() {
      saving.value = true
      error.value = ''
      try {
        await $fetch('/api/tasks', {
          method: 'POST',
          body: {
            ...form,
            assignedToId: form.assignedToId || null,
            objectId: form.objectId || null,
            dueDate: form.dueDate || null,
            estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null,
          },
        })
        dialog.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        saving.value = false
      }
    }

    async function changeStatus(task: any, newStatus: string) {
      if (task.status === newStatus) return
      // Optimistic update
      task.status = newStatus
      try {
        await $fetch(`/api/tasks/${task.id}`, { method: 'PUT', body: { status: newStatus } })
        await refresh()
      } catch {
        await refresh()
      }
    }

    function openDelete(task: any) {
      deleteTarget.value = task
      deleteDialog.value = true
    }

    async function confirmDelete() {
      if (!deleteTarget.value) return
      deleting.value = true
      try {
        await $fetch(`/api/tasks/${deleteTarget.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        deleteTarget.value = null
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка видалення'
      } finally {
        deleting.value = false
      }
    }

    function formatDate(d: string | null) {
      if (!d) return ''
      return new Date(d).toLocaleDateString('uk-UA')
    }

    function isOverdue(task: any) {
      if (!task.dueDate || task.status === 'DONE' || task.status === 'CANCELLED') return false
      return new Date(task.dueDate) < new Date()
    }

    // Drag & drop handlers
    function onDragStart(e: DragEvent, task: any) {
      dragTaskId.value = task.id
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', task.id)
      }
    }

    function onDragEnd() {
      dragTaskId.value = null
      dragOverStatus.value = null
    }

    function onDragOver(e: DragEvent, status: string) {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      dragOverStatus.value = status
    }

    function onDragLeave(e: DragEvent, colEl: HTMLElement) {
      // only clear highlight when leaving the column entirely (not just child elements)
      if (!colEl.contains(e.relatedTarget as Node)) {
        dragOverStatus.value = null
      }
    }

    async function onDrop(e: DragEvent, newStatus: string) {
      e.preventDefault()
      const id = dragTaskId.value ?? e.dataTransfer?.getData('text/plain')
      dragTaskId.value = null
      dragOverStatus.value = null
      if (!id) return
      const task = tasks.value.find((t: any) => t.id === id)
      if (task && task.status !== newStatus) {
        await changeStatus(task, newStatus)
      }
    }

    const headers = [
      { title: 'Назва', key: 'title', minWidth: 220 },
      { title: 'Статус', key: 'status', width: 140 },
      { title: 'Пріоритет', key: 'priority', width: 130 },
      { title: 'Виконавець', key: 'assignee', width: 160 },
      { title: 'Дедлайн', key: 'dueDate', width: 120 },
      { title: 'Год.', key: 'totalHours', width: 90 },
      { title: 'Підзавд.', key: 'subTasks', width: 90 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 100 },
    ]

    return () => (
      <div>
        {/* Header */}
        <div class="d-flex align-center mb-4 gap-2 flex-wrap">
          <div class="text-h5 font-weight-bold">Завдання</div>
          <v-spacer />
          {isAdmin.value && (
            <v-btn variant="outlined" size="small" prepend-icon="mdi-chart-bar" to="/tasks/reports">
              Репорти
            </v-btn>
          )}
          <div class="d-flex align-center" style="gap:8px">
            <v-btn
              variant={viewMode.value === 'kanban' ? 'tonal' : 'outlined'}
              size="small"
              icon="mdi-view-column"
              onClick={() => { viewMode.value = 'kanban' }}
            />
            <v-btn
              variant={viewMode.value === 'list' ? 'tonal' : 'outlined'}
              size="small"
              icon="mdi-format-list-bulleted"
              onClick={() => { viewMode.value = 'list' }}
            />
          </div>
          <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
            Нове завдання
          </v-btn>
        </div>

        {/* Filters */}
        <v-card class="mb-4 pa-4">
          <div class="d-flex flex-wrap align-center" style="gap: 16px">
            <v-select
              v-model={filterStatus.value}
              label="Статус"
              items={[{ value: '', title: 'Всі' }, ...STATUSES.map((s) => ({ value: s.value, title: s.label }))] }
              density="compact"
              style="min-width:160px; max-width:200px"
              clearable
              hide-details
            />
            <v-select
              v-model={filterPriority.value}
              label="Пріоритет"
              items={[{ value: '', title: 'Всі' }, ...PRIORITIES.map((p) => ({ value: p.value, title: p.label }))]}
              density="compact"
              style="min-width:160px; max-width:200px"
              clearable
              hide-details
            />
            <v-select
              v-model={filterAssignee.value}
              label="Виконавець"
              items={[{ value: '', title: 'Всі' }, ...users.value.map((u: any) => ({ value: u.id, title: u.name }))]}
              density="compact"
              style="min-width:180px; max-width:220px"
              clearable
              hide-details
            />
            {(filterStatus.value || filterPriority.value || filterAssignee.value) && (
              <v-btn
                variant="text"
                size="small"
                color="error"
                prepend-icon="mdi-filter-remove"
                onClick={() => { filterStatus.value = ''; filterPriority.value = ''; filterAssignee.value = '' }}
              >
                Скинути
              </v-btn>
            )}
          </div>
        </v-card>

        {/* Kanban view */}
        {viewMode.value === 'kanban' && (
          <div class="d-flex overflow-x-auto pb-2" style="gap: 16px; align-items: flex-start">
            {STATUSES.map((col) => {
              const isOver = dragOverStatus.value === col.value
              return (
                <div
                  key={col.value}
                  style="min-width:272px; width:272px; flex-shrink:0"
                  onDragover={(e: DragEvent) => onDragOver(e, col.value)}
                  onDragleave={(e: DragEvent) => {
                    const el = (e.currentTarget as HTMLElement)
                    onDragLeave(e, el)
                  }}
                  onDrop={(e: DragEvent) => onDrop(e, col.value)}
                >
                  <v-card
                    variant="outlined"
                    style={{
                      transition: 'box-shadow 0.15s, border-color 0.15s',
                      ...(isOver ? { boxShadow: '0 0 0 2px currentColor', opacity: 1 } : {}),
                    }}
                    class={isOver ? `border-${col.color}` : ''}
                  >
                    <div class="pa-3 d-flex align-center gap-2">
                      <v-icon color={col.color} size="18">{col.icon}</v-icon>
                      <span class="text-subtitle-2 font-weight-bold">{col.label}</span>
                      <v-chip size="x-small" class="ml-auto" color={col.color} variant="tonal">
                        {tasksByStatus.value[col.value]?.length ?? 0}
                      </v-chip>
                    </div>
                    <v-divider />

                    <div
                      class="pa-2 d-flex flex-column"
                      style={{
                        gap: '8px',
                        minHeight: '120px',
                        background: isOver ? 'rgba(var(--v-theme-primary), 0.04)' : undefined,
                        transition: 'background 0.15s',
                      }}
                    >
                      {pending.value
                        ? <v-skeleton-loader type="card" />
                        : tasksByStatus.value[col.value]?.map((task: any) => (
                          <v-card
                            key={task.id}
                            variant="elevated"
                            elevation={dragTaskId.value === task.id ? 8 : 1}
                            class="pa-3"
                            draggable={true}
                            style={{
                              cursor: 'grab',
                              opacity: dragTaskId.value === task.id ? 0.45 : 1,
                              transition: 'opacity 0.15s, box-shadow 0.15s',
                            }}
                            onDragstart={(e: DragEvent) => onDragStart(e, task)}
                            onDragend={onDragEnd}
                            onClick={() => navigateTo(`/tasks/${task.id}`)}
                          >
                            <div class="d-flex align-start gap-1 mb-2">
                              <v-chip
                                size="x-small"
                                color={priorityMeta(task.priority).color}
                                variant="tonal"
                                prepend-icon={priorityMeta(task.priority).icon}
                              >
                                {priorityMeta(task.priority).label}
                              </v-chip>
                              <v-spacer />
                              <v-menu>
                                {{
                                  activator: ({ props }: any) => (
                                    <v-btn
                                      {...props}
                                      icon="mdi-dots-vertical"
                                      size="x-small"
                                      variant="text"
                                      onClick={(e: Event) => e.stopPropagation()}
                                    />
                                  ),
                                  default: () => (
                                    <v-list density="compact">
                                      {STATUSES.filter((s) => s.value !== task.status).map((s) => (
                                        <v-list-item
                                          key={s.value}
                                          prepend-icon={s.icon}
                                          title={`→ ${s.label}`}
                                          onClick={(e: Event) => { e.stopPropagation(); changeStatus(task, s.value) }}
                                        />
                                      ))}
                                      <v-divider />
                                      <v-list-item
                                        prepend-icon="mdi-delete"
                                        title="Видалити"
                                        base-color="error"
                                        onClick={(e: Event) => { e.stopPropagation(); openDelete(task) }}
                                      />
                                    </v-list>
                                  ),
                                }}
                              </v-menu>
                            </div>
                            <div class="text-body-2 font-weight-medium mb-2" style="line-height:1.3">
                              {task.title}
                            </div>
                            <div class="d-flex align-center gap-1 flex-wrap">
                              {task.assignee && (
                                <v-chip size="x-small" prepend-icon="mdi-account" variant="text">
                                  {task.assignee.name}
                                </v-chip>
                              )}
                              {task.dueDate && (
                                <v-chip
                                  size="x-small"
                                  prepend-icon="mdi-calendar"
                                  color={isOverdue(task) ? 'error' : 'default'}
                                  variant="text"
                                >
                                  {formatDate(task.dueDate)}
                                </v-chip>
                              )}
                            {task.totalHours > 0 && (
                              <v-chip size="x-small" prepend-icon="mdi-clock-outline" variant="text">
                                {task.totalHours.toFixed(1)}г
                              </v-chip>
                            )}
                            {task._count?.subTasks > 0 && (
                              <v-chip size="x-small" prepend-icon="mdi-file-tree" variant="text">
                                {task._count.subTasks}
                              </v-chip>
                            )}
                            </div>
                          </v-card>
                        ))
                      }
                      {!pending.value && tasksByStatus.value[col.value]?.length === 0 && (
                        <div
                          class="text-center text-disabled text-caption d-flex align-center justify-center"
                          style={{
                            minHeight: '80px',
                            border: isOver ? '2px dashed rgba(var(--v-theme-primary), 0.5)' : '2px dashed transparent',
                            borderRadius: '8px',
                            transition: 'border 0.15s',
                          }}
                        >
                          {isOver ? 'Відпустіть тут' : 'Немає завдань'}
                        </div>
                      )}
                    </div>
                  </v-card>
                </div>
              )
            })}
          </div>
        )}

        {/* List view */}
        {viewMode.value === 'list' && (
          <v-card>
            <v-data-table headers={headers} items={tasks.value} loading={pending.value} hover>
              {{
                'item.title': ({ item }: any) => (
                  <v-btn variant="text" class="text-none px-0" to={`/tasks/${item.id}`}>
                    {item.title}
                  </v-btn>
                ),
                'item.status': ({ item }: any) => {
                  const s = statusMeta(item.status)
                  return (
                    <v-chip size="small" color={s.color} variant="tonal" prepend-icon={s.icon}>
                      {s.label}
                    </v-chip>
                  )
                },
                'item.priority': ({ item }: any) => {
                  const p = priorityMeta(item.priority)
                  return (
                    <v-chip size="small" color={p.color} variant="tonal" prepend-icon={p.icon}>
                      {p.label}
                    </v-chip>
                  )
                },
                'item.assignee': ({ item }: any) => item.assignee?.name ?? '—',
                'item.dueDate': ({ item }: any) => (
                  <span class={isOverdue(item) ? 'text-error' : ''}>
                    {formatDate(item.dueDate) || '—'}
                  </span>
                ),
                'item.totalHours': ({ item }: any) => (
                  <span>{item.totalHours > 0 ? `${item.totalHours.toFixed(1)}г` : '—'}</span>
                ),
                'item.subTasks': ({ item }: any) => (
                  item._count?.subTasks > 0
                    ? <v-chip size="small" prepend-icon="mdi-file-tree" variant="tonal">{item._count.subTasks}</v-chip>
                    : <span class="text-disabled">—</span>
                ),
                'item.actions': ({ item }: any) => (
                  <div class="d-flex gap-1 justify-end">
                    <v-btn icon="mdi-eye" variant="text" size="small" to={`/tasks/${item.id}`} />
                    <v-btn icon="mdi-delete" variant="text" size="small" color="error" onClick={() => openDelete(item)} />
                  </div>
                ),
              }}
            </v-data-table>
          </v-card>
        )}

        {/* Create task dialog */}
        <v-dialog v-model={dialog.value} max-width={560}>
          <v-card>
            <v-card-title class="pa-4">Нове завдання</v-card-title>
            <v-card-text class="pa-5 pt-2">
              {error.value && <v-alert type="error" variant="tonal" class="mb-4">{error.value}</v-alert>}
              <v-text-field v-model={form.title} label="Назва *" class="mb-4" />
              <v-textarea v-model={form.description} label="Опис" rows={3} class="mb-4" />
              <div class="d-flex mb-4" style="gap:16px">
                <v-select
                  v-model={form.priority}
                  label="Пріоритет"
                  items={PRIORITIES.map((p) => ({ value: p.value, title: p.label }))}
                  style="flex:1"
                />
                <v-select
                  v-model={form.assignedToId}
                  label="Виконавець"
                  items={[{ value: '', title: 'Не призначено' }, ...users.value.map((u: any) => ({ value: u.id, title: u.name }))]}
                  style="flex:1"
                />
              </div>
              <div class="d-flex mb-4" style="gap:16px">
                <v-select
                  v-model={form.objectId}
                  label="Обʼєкт"
                  items={[{ value: '', title: 'Без обʼєкту' }, ...objects.value.map((o: any) => ({ value: o.id, title: o.name }))]}
                  style="flex:1"
                />
                <v-text-field
                  v-model={form.dueDate}
                  label="Дедлайн"
                  type="date"
                  style="flex:1"
                />
              </div>
              <v-text-field
                v-model={form.estimatedHours}
                label="Оцінка (год.)"
                type="number"
                min="0"
                step="0.5"
              />
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (dialog.value = false)}>Скасувати</v-btn>
              <v-btn color="primary" variant="elevated" loading={saving.value} disabled={!form.title.trim()} onClick={save}>
                Створити
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        {/* Delete dialog */}
        <v-dialog v-model={deleteDialog.value} max-width={420}>
          <v-card>
            <v-card-title>Видалити завдання?</v-card-title>
            <v-card-text>
              Завдання "<strong>{deleteTarget.value?.title}</strong>" та всі пов'язані дані будуть видалені.
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (deleteDialog.value = false)}>Скасувати</v-btn>
              <v-btn color="error" variant="elevated" loading={deleting.value} onClick={confirmDelete}>Видалити</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
