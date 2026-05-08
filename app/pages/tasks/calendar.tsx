const STATUS_COLORS: Record<string, string> = {
  TODO: '#607D8B',
  IN_PROGRESS: '#1976D2',
  REVIEW: '#F57C00',
  DONE: '#388E3C',
  CANCELLED: '#757575',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#43A047',
  MEDIUM: '#FB8C00',
  HIGH: '#E64A19',
  URGENT: '#D32F2F',
}

const STATUS_LABELS: Record<string, string> = {
  TODO: 'До виконання',
  IN_PROGRESS: 'В роботі',
  REVIEW: 'На перевірці',
  DONE: 'Виконано',
  CANCELLED: 'Скасовано',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Низький',
  MEDIUM: 'Середній',
  HIGH: 'Високий',
  URGENT: 'Терміново',
}

export default defineComponent({
  name: 'TaskCalendarPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Календар завдань' })

    const router = useRouter()
    const { isEmployee, isPrivileged } = useAuth()

    const filterStatus = ref('')
    const filterObjectId = ref('')
    const filterAssigneeId = ref('')
    const colorBy = ref<'status' | 'priority'>('status')

    const { data: tasksData, refresh } = useFetch('/api/tasks', {
      query: computed(() => ({
        ...(filterStatus.value && { status: filterStatus.value }),
        ...(filterObjectId.value && { objectId: filterObjectId.value }),
        ...(filterAssigneeId.value && { assignedToId: filterAssigneeId.value }),
      })),
    })

    const { data: objectsData } = useFetch('/api/objects', { skip: () => isEmployee.value })
    const assigneesUrl = computed(() => (isPrivileged.value ? '/api/users' : '/api/users/list'))
    const { data: usersData } = useFetch(assigneesUrl, { watch: [assigneesUrl] })

    const tasks = computed(() => (tasksData.value as any)?.tasks ?? [])
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])
    const users = computed(() => {
      const v = usersData.value as any
      if (Array.isArray(v)) return v
      return v?.users ?? []
    })

    const tasksWithDate = computed(() => tasks.value.filter((t: any) => t.dueDate))
    const tasksWithoutDate = computed(() => tasks.value.filter((t: any) => !t.dueDate))

    async function handleDateChange(taskId: string, newDate: string) {
      await $fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        body: { dueDate: newDate ? new Date(newDate).toISOString() : null },
      })
      await refresh()
    }

    function handleTaskClick(taskId: string) {
      router.push(`/tasks/${taskId}`)
    }

    const statusItems = [
      { title: 'Всі статуси', value: '' },
      { title: 'До виконання', value: 'TODO' },
      { title: 'В роботі', value: 'IN_PROGRESS' },
      { title: 'На перевірці', value: 'REVIEW' },
      { title: 'Виконано', value: 'DONE' },
      { title: 'Скасовано', value: 'CANCELLED' },
    ]

    return () => (
      <div>
        {/* Toolbar */}
        <div class="d-flex align-center flex-wrap gap-2 mb-4">
          <div class="text-h6 font-weight-bold">Календар завдань</div>
          <v-spacer />

          <v-select
            modelValue={filterStatus.value}
            onUpdate:modelValue={(v: string) => { filterStatus.value = v }}
            items={statusItems}
            density="compact"
            variant="outlined"
            hide-details
            style={{ minWidth: '170px', maxWidth: '200px' }}
            label="Статус"
          />

          {!isEmployee.value && (
            <v-autocomplete
              modelValue={filterObjectId.value}
              onUpdate:modelValue={(v: string) => { filterObjectId.value = v ?? '' }}
              items={[
                { title: 'Всі обʼєкти', id: '' },
                ...objects.value.map((o: any) => ({ title: o.name, id: o.id })),
              ]}
              item-title="title"
              item-value="id"
              density="compact"
              variant="outlined"
              hide-details
              clearable
              style={{ minWidth: '180px', maxWidth: '220px' }}
              label="Обʼєкт"
            />
          )}

          <v-autocomplete
            modelValue={filterAssigneeId.value}
            onUpdate:modelValue={(v: string) => { filterAssigneeId.value = v ?? '' }}
            items={[
              { title: 'Всі виконавці', id: '' },
              ...users.value.map((u: any) => ({ title: u.name, id: u.id })),
            ]}
            item-title="title"
            item-value="id"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            style={{ minWidth: '180px', maxWidth: '220px' }}
            label="Виконавець"
          />

          <v-btn-toggle
            modelValue={colorBy.value}
            onUpdate:modelValue={(v: 'status' | 'priority') => { if (v) colorBy.value = v }}
            variant="outlined"
            density="compact"
            mandatory
            divided
          >
            <v-btn value="status" size="small" class="text-none px-3">За статусом</v-btn>
            <v-btn value="priority" size="small" class="text-none px-3">За пріоритетом</v-btn>
          </v-btn-toggle>
        </div>

        {/* Legend + no-date count */}
        <div class="d-flex flex-wrap align-center gap-2 mb-4">
          {colorBy.value === 'status'
            ? Object.entries(STATUS_COLORS).map(([k, color]) => (
                <v-chip
                  key={k}
                  size="small"
                  label
                  style={{ backgroundColor: color, color: '#fff', fontWeight: 500 }}
                >
                  {STATUS_LABELS[k]}
                </v-chip>
              ))
            : Object.entries(PRIORITY_COLORS).map(([k, color]) => (
                <v-chip
                  key={k}
                  size="small"
                  label
                  style={{ backgroundColor: color, color: '#fff', fontWeight: 500 }}
                >
                  {PRIORITY_LABELS[k]}
                </v-chip>
              ))}
          <v-spacer />
          {tasksWithoutDate.value.length > 0 && (
            <v-chip size="small" color="warning" variant="tonal" prepend-icon="mdi-calendar-remove-outline">
              {tasksWithoutDate.value.length} без дати
            </v-chip>
          )}
          <v-chip size="small" color="primary" variant="tonal" prepend-icon="mdi-calendar-check-outline">
            {tasksWithDate.value.length} на календарі
          </v-chip>
        </div>

        {/* Calendar */}
        <v-card elevation={1}>
          <v-card-text class="pa-3 pa-sm-4">
            <TaskCalendarWidget
              tasks={tasks.value}
              colorBy={colorBy.value}
              onTaskClick={handleTaskClick}
              onDateChange={handleDateChange}
            />
          </v-card-text>
        </v-card>

        {/* Tasks without date list */}
        {tasksWithoutDate.value.length > 0 && (
          <v-card class="mt-4" elevation={1}>
            <v-card-title class="text-body-1 font-weight-bold py-3 px-4">
              <v-icon class="mr-2" size="small">mdi-calendar-remove-outline</v-icon>
              Завдання без дедлайну ({tasksWithoutDate.value.length})
            </v-card-title>
            <v-divider />
            <v-list density="compact" class="py-1">
              {tasksWithoutDate.value.slice(0, 20).map((t: any) => (
                <v-list-item
                  key={t.id}
                  title={t.title}
                  subtitle={[
                    t.project?.name,
                    t.assignee?.name,
                    t.object?.name,
                  ].filter(Boolean).join(' · ')}
                  onClick={() => handleTaskClick(t.id)}
                  style={{ cursor: 'pointer' }}
                  rounded="lg"
                >
                  {{
                    prepend: () => (
                      <v-icon
                        color={STATUS_COLORS[t.status] ?? 'grey'}
                        size="small"
                        class="mr-1"
                      >
                        mdi-circle
                      </v-icon>
                    ),
                    append: () => (
                      <v-chip size="x-small" label color="grey-darken-1">
                        {t.priority}
                      </v-chip>
                    ),
                  }}
                </v-list-item>
              ))}
              {tasksWithoutDate.value.length > 20 && (
                <v-list-item class="text-center text-caption text-medium-emphasis">
                  + ще {tasksWithoutDate.value.length - 20} завдань
                </v-list-item>
              )}
            </v-list>
          </v-card>
        )}
      </div>
    )
  },
})
