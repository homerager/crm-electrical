import ProjectGantt from '~/components/ProjectGantt/index'

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

function statusMeta(val: string) { return STATUSES.find((s) => s.value === val) ?? STATUSES[0] }
function priorityMeta(val: string) { return PRIORITIES.find((p) => p.value === val) ?? PRIORITIES[1] }

export default defineComponent({
  name: 'ProjectDetailPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const router = useRouter()
    const projectId = computed(() => route.params.id as string)

    const { isEmployee } = useAuth()

    const viewMode = ref<'kanban' | 'list' | 'gantt'>('kanban')
    const filterStatus = ref('')
    const filterPriority = ref('')
    const filterAssignee = ref('')

    const taskDialog = ref(false)
    const deleteTaskDialog = ref(false)
    const saving = ref(false)
    const deleting = ref(false)
    const taskError = ref('')
    const deleteTarget = ref<any>(null)

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

    const { data: projectData, refresh: refreshProject } = useFetch(
      () => `/api/projects/${projectId.value}`,
    )
    const project = computed(() => projectData.value as any)

    useHead(computed(() => ({ title: project.value?.name ?? 'Проєкт' })))

    const { data: tasksData, refresh: refreshTasks, pending } = useFetch('/api/tasks', {
      query: computed(() => ({
        projectId: projectId.value,
        ...(filterStatus.value && { status: filterStatus.value }),
        ...(filterPriority.value && { priority: filterPriority.value }),
        ...(filterAssignee.value && { assignedToId: filterAssignee.value }),
      })),
    })

    const { data: objectsData } = useFetch('/api/objects', { skip: () => isEmployee.value })

    const tasks = computed(() => (tasksData.value as any)?.tasks ?? [])
    const projectMembers = computed(() => project.value?.members ?? [])
    const memberUsers = computed(() => projectMembers.value.map((m: any) => m.user))
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
      const defObj = project.value?.defaultObject?.id ?? project.value?.defaultObjectId ?? ''
      Object.assign(form, {
        title: '',
        description: '',
        priority: 'MEDIUM',
        assignedToId: '',
        objectId: defObj || '',
        dueDate: '',
        estimatedHours: '',
      })
      taskError.value = ''
      taskDialog.value = true
    }

    async function saveTask() {
      if (!form.title.trim()) { taskError.value = 'Назва обовʼязкова'; return }
      saving.value = true
      taskError.value = ''
      try {
        await $fetch('/api/tasks', {
          method: 'POST',
          body: {
            ...form,
            projectId: projectId.value,
            assignedToId: form.assignedToId || null,
            objectId: form.objectId || null,
            dueDate: form.dueDate || null,
            estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null,
          },
        })
        taskDialog.value = false
        await refreshTasks()
      } catch (e: any) {
        taskError.value = e?.data?.message || e?.data?.statusMessage || 'Помилка'
      } finally {
        saving.value = false
      }
    }

    async function changeStatus(task: any, newStatus: string) {
      if (task.status === newStatus) return
      task.status = newStatus
      try {
        await $fetch(`/api/tasks/${task.id}`, { method: 'PUT', body: { status: newStatus } })
        await refreshTasks()
      } catch { await refreshTasks() }
    }

    function openDeleteTask(task: any) { deleteTarget.value = task; deleteTaskDialog.value = true }

    async function confirmDeleteTask() {
      if (!deleteTarget.value) return
      deleting.value = true
      try {
        await $fetch(`/api/tasks/${deleteTarget.value.id}`, { method: 'DELETE' })
        deleteTaskDialog.value = false
        deleteTarget.value = null
        await refreshTasks()
      } finally { deleting.value = false }
    }

    // DnD
    function onDragStart(e: DragEvent, task: any) {
      dragTaskId.value = task.id
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', task.id) }
    }
    function onDragEnd() { dragTaskId.value = null; dragOverStatus.value = null }
    function onDragOver(e: DragEvent, status: string) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; dragOverStatus.value = status }
    function onDragLeave(e: DragEvent, colEl: HTMLElement) { if (!colEl.contains(e.relatedTarget as Node)) dragOverStatus.value = null }
    async function onDrop(e: DragEvent, newStatus: string) {
      e.preventDefault()
      const id = dragTaskId.value ?? e.dataTransfer?.getData('text/plain')
      dragTaskId.value = null; dragOverStatus.value = null
      if (!id) return
      const task = tasks.value.find((t: any) => t.id === id)
      if (task && task.status !== newStatus) await changeStatus(task, newStatus)
    }

    function formatDate(d: string | null) { if (!d) return ''; return new Date(d).toLocaleDateString('uk-UA') }
    function isOverdue(task: any) {
      if (!task.dueDate || task.status === 'DONE' || task.status === 'CANCELLED') return false
      return new Date(task.dueDate) < new Date()
    }

    const headers = [
      { title: 'Назва', key: 'title', minWidth: 220 },
      { title: 'Статус', key: 'status', width: 140 },
      { title: 'Пріоритет', key: 'priority', width: 130 },
      { title: 'Виконавець', key: 'assignee', width: 160 },
      { title: 'Дедлайн', key: 'dueDate', width: 120 },
      { title: 'Год.', key: 'totalHours', width: 90 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 100 },
    ]

    return () => {
      if (!project.value) {
        return (
          <v-container>
            <v-skeleton-loader type="heading,paragraph" />
          </v-container>
        )
      }

      return (
        <div>
          {/* Header */}
          <div class="page-toolbar">
            <div>
              <div class="d-flex align-center gap-2 mb-1">
                <v-btn
                  variant="text"
                  size="small"
                  prepend-icon="mdi-chevron-left"
                  onClick={() => router.push('/projects')}
                  class="text-medium-emphasis"
                >
                  Проєкти
                </v-btn>
              </div>
              <div class="d-flex align-center gap-2">
                <div
                  style={{ width: '16px', height: '16px', borderRadius: '4px', background: project.value.color, flexShrink: 0 }}
                />
                <h1 class="text-h5 font-weight-bold">{project.value.name}</h1>
              </div>
              {project.value.description && (
                <div class="text-body-2 text-medium-emphasis mt-1">{project.value.description}</div>
              )}
            </div>
            <v-spacer />

            {/* Members avatars */}
            <div class="d-flex align-center" style="gap:-4px; margin-right:8px">
              {projectMembers.value.slice(0, 6).map((m: any) => (
                <v-tooltip key={m.user.id} text={`${m.user.name}${m.role === 'OWNER' ? ' (Власник)' : ''}`} location="bottom">
                  {{
                    activator: ({ props }: any) => (
                      <v-avatar
                        {...props}
                        size="32"
                        color={project.value.color}
                        style="border: 2px solid rgba(var(--v-theme-surface),1); margin-left:-6px"
                      >
                        <span style="color:white;font-weight:700;font-size:12px">
                          {m.user.name?.charAt(0)?.toUpperCase()}
                        </span>
                      </v-avatar>
                    ),
                  }}
                </v-tooltip>
              ))}
              {projectMembers.value.length > 6 && (
                <v-avatar size="32" color="grey" style="border: 2px solid rgba(var(--v-theme-surface),1); margin-left:-6px">
                  <span style="color:white;font-size:11px">+{projectMembers.value.length - 6}</span>
                </v-avatar>
              )}
            </div>

            <div class="d-flex align-center" style="gap:8px">
              <v-btn
                variant={viewMode.value === 'kanban' ? 'tonal' : 'outlined'}
                size="small"
                icon="mdi-view-column"
                onClick={() => { viewMode.value = 'kanban' }}
                title="Канбан"
              />
              <v-btn
                variant={viewMode.value === 'list' ? 'tonal' : 'outlined'}
                size="small"
                icon="mdi-format-list-bulleted"
                onClick={() => { viewMode.value = 'list' }}
                title="Список"
              />
              <v-btn
                variant={viewMode.value === 'gantt' ? 'tonal' : 'outlined'}
                size="small"
                icon="mdi-chart-gantt"
                onClick={() => { viewMode.value = 'gantt' }}
                title="Діаграма Ганта"
              />
            </div>
            {!isEmployee.value && (
              <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
                Нове завдання
              </v-btn>
            )}
          </div>

          {/* Filters */}
          <v-card class="mb-4 pa-4">
            <div class="d-flex flex-wrap align-center" style="gap: 16px">
              <v-select
                v-model={filterStatus.value}
                label="Статус"
                items={[{ value: '', title: 'Всі' }, ...STATUSES.map((s) => ({ value: s.value, title: s.label }))]}
                density="compact" style="min-width:160px; max-width:200px" clearable hide-details
              />
              <v-select
                v-model={filterPriority.value}
                label="Пріоритет"
                items={[{ value: '', title: 'Всі' }, ...PRIORITIES.map((p) => ({ value: p.value, title: p.label }))]}
                density="compact" style="min-width:160px; max-width:200px" clearable hide-details
              />
              <v-select
                v-model={filterAssignee.value}
                label="Виконавець"
                items={[{ value: '', title: 'Всі' }, ...memberUsers.value.map((u: any) => ({ value: u.id, title: u.name }))]}
                density="compact" style="min-width:180px; max-width:220px" clearable hide-details
              />
              {(filterStatus.value || filterPriority.value || filterAssignee.value) && (
                <v-btn variant="text" size="small" color="error" prepend-icon="mdi-filter-remove"
                  onClick={() => { filterStatus.value = ''; filterPriority.value = ''; filterAssignee.value = '' }}>
                  Скинути
                </v-btn>
              )}
            </div>
          </v-card>

          {/* Gantt */}
          {viewMode.value === 'gantt' && (
            <ProjectGantt
              tasks={tasks.value}
              loading={pending.value}
              projectColor={project.value.color}
            />
          )}

          {/* Kanban */}
          {viewMode.value === 'kanban' && (
            <div class="d-flex overflow-x-auto pb-2" style="gap: 16px; align-items: flex-start">
              {STATUSES.map((col) => {
                const isOver = dragOverStatus.value === col.value
                return (
                  <div
                    key={col.value}
                    style="min-width:272px; width:272px; flex-shrink:0"
                    onDragover={(e: DragEvent) => onDragOver(e, col.value)}
                    onDragleave={(e: DragEvent) => onDragLeave(e, e.currentTarget as HTMLElement)}
                    onDrop={(e: DragEvent) => onDrop(e, col.value)}
                  >
                    <v-card
                      variant="outlined"
                      class={isOver ? `border-${col.color}` : ''}
                      style={{ transition: 'box-shadow 0.15s, border-color 0.15s', ...(isOver ? { boxShadow: '0 0 0 2px currentColor' } : {}) }}
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
                        style={{ gap: '8px', minHeight: '120px', background: isOver ? 'rgba(var(--v-theme-primary), 0.04)' : undefined, transition: 'background 0.15s' }}
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
                              style={{ cursor: 'grab', opacity: dragTaskId.value === task.id ? 0.45 : 1, transition: 'opacity 0.15s, box-shadow 0.15s' }}
                              onDragstart={(e: DragEvent) => onDragStart(e, task)}
                              onDragend={onDragEnd}
                              onClick={() => navigateTo(`/tasks/${task.id}`)}
                            >
                              <div class="d-flex align-start gap-1 mb-2">
                                <v-chip size="x-small" color={priorityMeta(task.priority).color} variant="tonal" prepend-icon={priorityMeta(task.priority).icon}>
                                  {priorityMeta(task.priority).label}
                                </v-chip>
                                <v-spacer />
                                <v-menu>
                                  {{
                                    activator: ({ props }: any) => (
                                      <v-btn {...props} icon="mdi-dots-vertical" size="x-small" variant="text" onClick={(e: Event) => e.stopPropagation()} />
                                    ),
                                    default: () => (
                                      <v-list density="compact">
                                        {STATUSES.filter((s) => s.value !== task.status).map((s) => (
                                          <v-list-item
                                            key={s.value}
                                            prepend-icon={s.icon}
                                            title={`→ ${s.label}`}
                                            onClick={() => changeStatus(task, s.value)}
                                          />
                                        ))}
                                        <v-divider />
                                        <v-list-item prepend-icon="mdi-delete" title="Видалити" base-color="error" onClick={() => openDeleteTask(task)} />
                                      </v-list>
                                    ),
                                  }}
                                </v-menu>
                              </div>
                              <div class="text-body-2 font-weight-medium mb-2 text-wrap">{task.title}</div>
                              <div class="d-flex align-center flex-wrap gap-1 text-caption text-medium-emphasis">
                                {task.assignee && (
                                  <span><v-icon size="12">mdi-account-outline</v-icon> {task.assignee.name}</span>
                                )}
                                {task.dueDate && (
                                  <v-chip size="x-small" color={isOverdue(task) ? 'error' : 'default'} variant="tonal">
                                    <v-icon start size="10">mdi-calendar</v-icon>
                                    {formatDate(task.dueDate)}
                                  </v-chip>
                                )}
                                {task._count?.subTasks > 0 && (
                                  <v-chip size="x-small" variant="tonal">
                                    <v-icon start size="10">mdi-file-tree</v-icon>
                                    {task._count.subTasks}
                                  </v-chip>
                                )}
                              </div>
                            </v-card>
                          ))
                        }
                      </div>
                    </v-card>
                  </div>
                )
              })}
            </div>
          )}

          {/* List view */}
          {viewMode.value === 'list' && (
            <v-data-table
              headers={headers}
              items={tasks.value}
              loading={pending.value}
              density="compact"
              hover
            >
              {{
                'item.title': ({ item }: any) => (
                  <NuxtLink to={`/tasks/${item.id}`} class="text-primary text-decoration-none font-weight-medium">
                    {item.title}
                  </NuxtLink>
                ),
                'item.status': ({ item }: any) => {
                  const s = statusMeta(item.status)
                  return <v-chip size="small" color={s.color} variant="tonal" prepend-icon={s.icon}>{s.label}</v-chip>
                },
                'item.priority': ({ item }: any) => {
                  const p = priorityMeta(item.priority)
                  return <v-chip size="small" color={p.color} variant="tonal" prepend-icon={p.icon}>{p.label}</v-chip>
                },
                'item.assignee': ({ item }: any) => item.assignee?.name ?? '—',
                'item.dueDate': ({ item }: any) => {
                  if (!item.dueDate) return '—'
                  return (
                    <span class={isOverdue(item) ? 'text-error' : ''}>
                      {formatDate(item.dueDate)}
                    </span>
                  )
                },
                'item.totalHours': ({ item }: any) => item.totalHours > 0 ? `${item.totalHours}г` : '—',
                'item.actions': ({ item }: any) => (
                  <div class="d-flex justify-end gap-1">
                    <v-btn icon="mdi-open-in-new" size="x-small" variant="text" onClick={() => navigateTo(`/tasks/${item.id}`)} />
                    <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" onClick={() => openDeleteTask(item)} />
                  </div>
                ),
              }}
            </v-data-table>
          )}

          {/* Create task dialog */}
          <v-dialog v-model={taskDialog.value} max-width={560} persistent>
            <v-card>
              <v-card-title class="pa-4">Нове завдання в проєкті</v-card-title>
              <v-divider />
              <v-card-text class="pa-4">
                {taskError.value && <v-alert type="error" class="mb-4">{taskError.value}</v-alert>}
                <v-text-field v-model={form.title} label="Назва *" variant="outlined" density="compact" class="mb-5" />
                <v-textarea v-model={form.description} label="Опис" variant="outlined" density="compact" rows={3} class="mb-5" />
                <div class="d-flex mb-5" style="gap:16px">
                  <v-select
                    v-model={form.priority} label="Пріоритет"
                    items={PRIORITIES.map((p) => ({ value: p.value, title: p.label }))}
                    variant="outlined" density="compact" style="flex:1"
                  />
                  <v-select
                    v-model={form.assignedToId}
                    label="Виконавець"
                    items={[{ value: '', title: 'Не призначено' }, ...memberUsers.value.map((u: any) => ({ value: u.id, title: u.name }))]}
                    variant="outlined" density="compact" style="flex:1"
                  />
                </div>
                <div class="d-flex mb-5" style="gap:16px">
                  <v-text-field v-model={form.dueDate} label="Дедлайн" type="date" variant="outlined" density="compact" style="flex:1" />
                  <v-text-field v-model={form.estimatedHours} label="Плановий час (год)" type="number" variant="outlined" density="compact" style="flex:1" />
                </div>
                <v-select
                  v-model={form.objectId}
                  label="Обʼєкт"
                  items={[{ value: '', title: 'Не вказано' }, ...objects.value.map((o: any) => ({ value: o.id, title: o.name }))]}
                  variant="outlined" density="compact"
                />
              </v-card-text>
              <v-divider />
              <v-card-actions class="pa-4">
                <v-spacer />
                <v-btn variant="text" onClick={() => { taskDialog.value = false }}>Скасувати</v-btn>
                <v-btn color="primary" loading={saving.value} onClick={saveTask}>Створити</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          {/* Delete task dialog */}
          <v-dialog v-model={deleteTaskDialog.value} max-width={400}>
            <v-card>
              <v-card-title class="pa-4">Видалити завдання?</v-card-title>
              <v-card-text>Завдання "<strong>{deleteTarget.value?.title}</strong>" буде видалено назавжди.</v-card-text>
              <v-card-actions class="pa-4">
                <v-spacer />
                <v-btn variant="text" onClick={() => { deleteTaskDialog.value = false }}>Скасувати</v-btn>
                <v-btn color="error" loading={deleting.value} onClick={confirmDeleteTask}>Видалити</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </div>
      )
    }
  },
})
