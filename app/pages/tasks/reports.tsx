const STATUS_LABELS: Record<string, string> = {
  TODO: 'До виконання',
  IN_PROGRESS: 'В роботі',
  REVIEW: 'На перевірці',
  DONE: 'Виконано',
  CANCELLED: 'Скасовано',
}
const STATUS_COLORS: Record<string, string> = {
  TODO: 'blue-grey',
  IN_PROGRESS: 'blue',
  REVIEW: 'orange',
  DONE: 'success',
  CANCELLED: 'error',
}
const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Низький',
  MEDIUM: 'Середній',
  HIGH: 'Високий',
  URGENT: 'Терміново',
}
const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'orange',
  URGENT: 'error',
}

export default defineComponent({
  name: 'TaskReportsPage',
  setup() {
    definePageMeta({ middleware: ['auth', 'admin'] })
    useHead({ title: 'Репорти завдань' })

    const { isAdmin } = useAuth()

    const dateFrom = ref('')
    const dateTo = ref('')

    const { data, pending, refresh } = useFetch('/api/reports/tasks', {
      query: computed(() => ({
        ...(dateFrom.value && { from: dateFrom.value }),
        ...(dateTo.value && { to: dateTo.value }),
      })),
    })

    const report = computed(() => data.value as any)

    const timeLogsHeaders = [
      { title: 'Дата', key: 'date', width: 120 },
      { title: 'Виконавець', key: 'user', width: 160 },
      { title: 'Записав', key: 'createdBy', width: 140 },
      { title: 'Завдання', key: 'task' },
      { title: 'Опис', key: 'description' },
      { title: 'Годин', key: 'hours', width: 90, align: 'end' as const },
    ]

    function formatDate(d: string) {
      if (!d) return '—'
      return new Date(d).toLocaleDateString('uk-UA')
    }

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Репорти завдань</div>
          <v-spacer />
          <v-btn variant="outlined" prepend-icon="mdi-arrow-left" to="/tasks" size="small">
            До завдань
          </v-btn>
          {isAdmin.value && (
            <v-btn color="success" prepend-icon="mdi-currency-usd" to="/tasks/salary" size="small">
              Зарплатний звіт
            </v-btn>
          )}
        </div>

        {/* Date filter */}
        <v-card class="mb-5 pa-4">
          <v-row dense align="center">
            <v-col cols={12} sm="auto">
              <v-text-field
                v-model={dateFrom.value}
                label="Від"
                type="date"
                density="compact"
                hide-details
                class="w-100"
                style={{ maxWidth: '220px' }}
              />
            </v-col>
            <v-col cols={12} sm="auto">
              <v-text-field
                v-model={dateTo.value}
                label="До"
                type="date"
                density="compact"
                hide-details
                class="w-100"
                style={{ maxWidth: '220px' }}
              />
            </v-col>
            {(dateFrom.value || dateTo.value) && (
              <v-col cols={12} sm="auto">
                <v-btn
                  variant="text"
                  size="small"
                  color="error"
                  prepend-icon="mdi-filter-remove"
                  onClick={() => { dateFrom.value = ''; dateTo.value = '' }}
                >
                  Скинути
                </v-btn>
              </v-col>
            )}
          </v-row>
        </v-card>

        <div class="d-flex flex-wrap mb-4" style="gap:20px">
          {/* Tasks by status */}
          <v-card style="flex:1; min-width:280px">
            <v-card-title class="pa-4 pb-2">
              <v-icon class="mr-2" color="primary">mdi-chart-pie</v-icon>
              Завдання за статусом
            </v-card-title>
            <v-list density="compact" class="pa-2">
              {pending.value
                ? <v-skeleton-loader type="list-item-two-line" />
                : (report.value?.tasksByStatus ?? []).map((r: any) => (
                  <v-list-item key={r.status}>
                    {{
                      prepend: () => (
                        <v-chip
                          size="small"
                          color={STATUS_COLORS[r.status]}
                          variant="tonal"
                          style="min-width:130px"
                        >
                          {STATUS_LABELS[r.status] ?? r.status}
                        </v-chip>
                      ),
                      append: () => (
                        <v-chip size="small" variant="tonal">{r.count}</v-chip>
                      ),
                    }}
                  </v-list-item>
                ))
              }
            </v-list>
          </v-card>

          {/* Tasks by priority */}
          <v-card style="flex:1; min-width:280px">
            <v-card-title class="pa-4 pb-2">
              <v-icon class="mr-2" color="primary">mdi-flag-outline</v-icon>
              Завдання за пріоритетом
            </v-card-title>
            <v-list density="compact" class="pa-2">
              {pending.value
                ? <v-skeleton-loader type="list-item-two-line" />
                : (report.value?.tasksByPriority ?? []).map((r: any) => (
                  <v-list-item key={r.priority}>
                    {{
                      prepend: () => (
                        <v-chip
                          size="small"
                          color={PRIORITY_COLORS[r.priority]}
                          variant="tonal"
                          style="min-width:130px"
                        >
                          {PRIORITY_LABELS[r.priority] ?? r.priority}
                        </v-chip>
                      ),
                      append: () => (
                        <v-chip size="small" variant="tonal">{r.count}</v-chip>
                      ),
                    }}
                  </v-list-item>
                ))
              }
            </v-list>
          </v-card>

          {/* Hours by user */}
          <v-card style="flex:1; min-width:280px">
            <v-card-title class="pa-4 pb-2">
              <v-icon class="mr-2" color="primary">mdi-account-clock</v-icon>
              Години за виконавцями
            </v-card-title>
            <v-list density="compact" class="pa-2">
              {pending.value
                ? <v-skeleton-loader type="list-item-two-line" />
                : (report.value?.timeByUser ?? []).length === 0
                  ? <v-list-item title="Немає даних" />
                  : (report.value?.timeByUser ?? [])
                    .sort((a: any, b: any) => b.totalHours - a.totalHours)
                    .map((r: any) => (
                      <v-list-item key={r.userId}>
                        {{
                          prepend: () => (
                            <v-avatar color="primary" size="32" variant="tonal">
                              <span class="text-caption">{r.userName.charAt(0).toUpperCase()}</span>
                            </v-avatar>
                          ),
                          default: () => (
                            <v-list-item-title>{r.userName}</v-list-item-title>
                          ),
                          append: () => (
                            <v-chip color="primary" size="small" variant="tonal">
                              {Number(r.totalHours).toFixed(1)}г
                            </v-chip>
                          ),
                        }}
                      </v-list-item>
                    ))
              }
            </v-list>
          </v-card>
        </div>

        {/* Recent time logs */}
        <v-card>
          <v-card-title class="pa-4 pb-0">
            <v-icon class="mr-2" color="primary">mdi-history</v-icon>
            Записи часу
          </v-card-title>
          <v-data-table
            headers={timeLogsHeaders}
            items={report.value?.recentTimeLogs ?? []}
            loading={pending.value}
            items-per-page={20}
          >
            {{
              'item.date': ({ item }: any) => formatDate(item.date),
              'item.user': ({ item }: any) => item.user?.name ?? '—',
              'item.createdBy': ({ item }: any) => (
                <span class="text-body-2">{item.createdBy?.name ?? '—'}</span>
              ),
              'item.task': ({ item }: any) =>
                item.taskId && item.task ? (
                  <v-btn variant="text" class="text-none px-0" size="small" to={`/tasks/${item.taskId}`}>
                    {item.task.title}
                  </v-btn>
                ) : item.object ? (
                  <span class="text-body-2">
                    {item.object.name}
                    <span class="text-caption text-disabled"> (без завдання)</span>
                  </span>
                ) : (
                  <span class="text-medium-emphasis">—</span>
                ),
              'item.description': ({ item }: any) => (
                <span class="text-body-2 text-disabled">{item.description ?? '—'}</span>
              ),
              'item.hours': ({ item }: any) => (
                <strong>{item.hours}г</strong>
              ),
            }}
          </v-data-table>
        </v-card>
      </div>
    )
  },
})
