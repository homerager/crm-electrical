export default defineComponent({
  name: 'SalaryReportPage',
  setup() {
    definePageMeta({ middleware: ['auth', 'strict-admin'] })
    useHead({ title: 'Зарплатний звіт' })

    // Default: current month
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    function toDateInput(d: Date) {
      return d.toISOString().slice(0, 10)
    }

    const dateFrom = ref(toDateInput(firstDay))
    const dateTo = ref(toDateInput(lastDay))
    const filterUserId = ref('')
    const expandedUser = ref<string | null>(null)

    const { data, pending, refresh } = useFetch('/api/reports/salary', {
      query: computed(() => ({
        ...(dateFrom.value && { from: dateFrom.value }),
        ...(dateTo.value && { to: dateTo.value }),
        ...(filterUserId.value && { userId: filterUserId.value }),
      })),
    })

    const { data: usersData } = useFetch('/api/users/list')
    const users = computed(() => (usersData.value as any[]) ?? [])

    const report = computed(() => data.value as any)
    const userRows = computed(() => report.value?.users ?? [])
    const grandTotal = computed(() =>
      userRows.value.reduce((s: number, u: any) => s + u.totalHours, 0),
    )
    const grandSalary = computed(() =>
      userRows.value.reduce((s: number, u: any) => s + (typeof u.totalAmount === 'number' ? u.totalAmount : 0), 0),
    )
    const hasSalaryTotals = computed(() => userRows.value.some((u: any) => u.hourlyRate != null))

    function formatDate(d: string) {
      if (!d) return '—'
      return new Date(d).toLocaleDateString('uk-UA')
    }

    function toggleUser(uid: string) {
      expandedUser.value = expandedUser.value === uid ? null : uid
    }

    function setCurrentMonth() {
      const n = new Date()
      dateFrom.value = toDateInput(new Date(n.getFullYear(), n.getMonth(), 1))
      dateTo.value = toDateInput(new Date(n.getFullYear(), n.getMonth() + 1, 0))
    }

    function setPrevMonth() {
      const n = new Date()
      dateFrom.value = toDateInput(new Date(n.getFullYear(), n.getMonth() - 1, 1))
      dateTo.value = toDateInput(new Date(n.getFullYear(), n.getMonth(), 0))
    }

    function exportCSV() {
      const rows: string[][] = [
        ['Виконавець', 'Дата', 'Записав', 'Завдання', 'Проєкт', 'Обʼєкт', 'Опис', 'Годин', 'Ставка грн/год', 'Сума грн'],
      ]
      for (const u of userRows.value) {
        const rateNum = u.hourlyRate != null ? Number(u.hourlyRate) : null
        for (const log of u.logs) {
          const lineSum = rateNum != null ? (log.hours * rateNum).toFixed(2) : ''
          rows.push([
            u.userName,
            formatDate(log.date),
            log.createdBy?.name ?? '—',
            log.task?.title ?? (log.object?.name ? '(без завдання)' : '—'),
            log.task?.project?.name ?? '—',
            log.task?.object?.name ?? log.object?.name ?? '—',
            log.description ?? '—',
            String(log.hours),
            rateNum != null ? String(rateNum) : '',
            lineSum,
          ])
        }
        rows.push([
          u.userName,
          '',
          '',
          '',
          '',
          '',
          'РАЗОМ:',
          String(Number(u.totalHours).toFixed(2)),
          u.hourlyRate != null ? String(Number(u.hourlyRate)) : '',
          u.totalAmount != null ? String(u.totalAmount) : '',
        ])
        rows.push([])
      }

      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      const bom = '\uFEFF'
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const period = `${dateFrom.value}_${dateTo.value}`
      a.download = `salary_report_${period}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }

    return () => (
      <div>
        {/* Header */}
        <div class="d-flex align-center mb-5 gap-2 flex-wrap">
          <div>
            <h1 class="text-h5 font-weight-bold">Зарплатний звіт</h1>
            <div class="text-caption text-medium-emphasis">Облік годин виконавців для розрахунку зарплати</div>
          </div>
          <v-spacer />
          <v-btn variant="outlined" prepend-icon="mdi-arrow-left" to="/tasks/reports" size="small">
            Репорти
          </v-btn>
          <v-btn
            color="success"
            prepend-icon="mdi-file-excel-outline"
            onClick={exportCSV}
            disabled={userRows.value.length === 0}
          >
            Експорт CSV
          </v-btn>
        </div>

        {/* Filters */}
        <v-card class="mb-5 pa-4">
          <div class="d-flex flex-wrap align-center" style="gap:16px">
            <v-text-field
              v-model={dateFrom.value}
              label="Від"
              type="date"
              density="compact"
              hide-details
              variant="outlined"
              style="max-width:180px"
            />
            <v-text-field
              v-model={dateTo.value}
              label="До"
              type="date"
              density="compact"
              hide-details
              variant="outlined"
              style="max-width:180px"
            />
            <v-select
              v-model={filterUserId.value}
              label="Виконавець"
              items={[{ value: '', title: 'Всі' }, ...users.value.map((u: any) => ({ value: u.id, title: u.name }))]}
              density="compact"
              hide-details
              variant="outlined"
              clearable
              style="max-width:220px"
            />
            <v-btn variant="tonal" size="small" onClick={setCurrentMonth}>Цей місяць</v-btn>
            <v-btn variant="tonal" size="small" onClick={setPrevMonth}>Минулий місяць</v-btn>
          </div>
        </v-card>

        {/* Summary cards */}
        {!pending.value && userRows.value.length > 0 && (
          <v-row class="mb-5">
            <v-col cols={12} sm={4} md={3}>
              <v-card color="primary" variant="tonal" class="pa-4 text-center">
                <div class="text-h4 font-weight-bold">{Number(grandTotal.value).toFixed(1)}</div>
                <div class="text-body-2 mt-1">Загально годин</div>
              </v-card>
            </v-col>
            <v-col cols={12} sm={4} md={3}>
              <v-card color="success" variant="tonal" class="pa-4 text-center">
                <div class="text-h4 font-weight-bold">{userRows.value.length}</div>
                <div class="text-body-2 mt-1">Виконавців</div>
              </v-card>
            </v-col>
            <v-col cols={12} sm={4} md={3}>
              <v-card color="warning" variant="tonal" class="pa-4 text-center">
                <div class="text-h4 font-weight-bold">{report.value?.totalLogs ?? 0}</div>
                <div class="text-body-2 mt-1">Записів часу</div>
              </v-card>
            </v-col>
            {hasSalaryTotals.value && (
              <v-col cols={12} sm={4} md={3}>
                <v-card color="teal" variant="tonal" class="pa-4 text-center">
                  <div class="text-h4 font-weight-bold">
                    {grandSalary.value.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₴
                  </div>
                  <div class="text-body-2 mt-1">Нараховано (за ставкою)</div>
                </v-card>
              </v-col>
            )}
          </v-row>
        )}

        {/* Per-user breakdown */}
        {pending.value && <v-skeleton-loader type="table" />}

        {!pending.value && userRows.value.length === 0 && (
          <v-card class="text-center pa-12" variant="outlined">
            <v-icon size="64" color="medium-emphasis" class="mb-4">mdi-clock-alert-outline</v-icon>
            <div class="text-h6 text-medium-emphasis">Немає записів за вказаний період</div>
          </v-card>
        )}

        {!pending.value && userRows.value.map((u: any) => (
          <v-card key={u.userId} class="mb-4">
            {/* User header row */}
            <div
              class="d-flex align-center pa-4"
              style="cursor:pointer; gap:12px"
              onClick={() => toggleUser(u.userId)}
            >
              <v-avatar color="primary" size="40" variant="tonal">
                <span class="text-subtitle-1 font-weight-bold">
                  {u.userName.charAt(0).toUpperCase()}
                </span>
              </v-avatar>
              <div style="flex:1">
                <div class="text-subtitle-1 font-weight-bold">{u.userName}</div>
                <div class="text-caption text-medium-emphasis">{u.logs.length} записів</div>
              </div>
              <div class="d-flex align-center flex-wrap" style="gap:8px; justify-content:flex-end">
                <v-chip color="primary" variant="tonal" size="large" class="font-weight-bold px-4">
                  {Number(u.totalHours).toFixed(2)} год
                </v-chip>
                {u.hourlyRate != null && (
                  <v-chip color="teal" variant="tonal" size="large" class="font-weight-bold px-4">
                    {Number(u.totalAmount).toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₴
                    <span class="text-caption ms-1 text-medium-emphasis">
                      ({Number(u.hourlyRate).toLocaleString('uk-UA')} ₴/год)
                    </span>
                  </v-chip>
                )}
                {u.hourlyRate == null && (
                  <v-chip size="small" variant="outlined" color="medium-emphasis">
                    Ставка не задана
                  </v-chip>
                )}
              </div>
              <v-icon>{expandedUser.value === u.userId ? 'mdi-chevron-up' : 'mdi-chevron-down'}</v-icon>
            </div>

            {/* Expanded logs table */}
            {expandedUser.value === u.userId && (
              <>
                <v-divider />
                <v-data-table
                  headers={[
                    { title: 'Дата', key: 'date', width: 110 },
                    { title: 'Записав', key: 'createdBy', width: 120 },
                    { title: 'Завдання', key: 'task' },
                    { title: 'Проєкт', key: 'project', width: 160 },
                    { title: 'Обʼєкт', key: 'object', width: 160 },
                    { title: 'Опис', key: 'description' },
                    { title: 'Год.', key: 'hours', width: 80, align: 'end' as const },
                  ]}
                  items={u.logs}
                  density="compact"
                  hide-default-footer={u.logs.length <= 10}
                  items-per-page={u.logs.length <= 10 ? u.logs.length : 10}
                >
                  {{
                    'item.date': ({ item }: any) => (
                      <span class="text-body-2">{formatDate(item.date)}</span>
                    ),
                    'item.createdBy': ({ item }: any) => (
                      <span class="text-body-2">{item.createdBy?.name ?? '—'}</span>
                    ),
                    'item.task': ({ item }: any) =>
                      item.taskId && item.task ? (
                        <NuxtLink to={`/tasks/${item.taskId}`} class="text-primary text-decoration-none">
                          {item.task.title}
                        </NuxtLink>
                      ) : (
                        <span class="text-body-2 text-medium-emphasis">—</span>
                      ),
                    'item.project': ({ item }: any) => {
                      const p = item.task?.project
                      if (!p) return <span class="text-disabled">—</span>
                      return (
                        <div class="d-flex align-center gap-1">
                          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: p.color, flexShrink: 0 }} />
                          <span class="text-body-2">{p.name}</span>
                        </div>
                      )
                    },
                    'item.object': ({ item }: any) => (
                      <span class="text-body-2">{item.task?.object?.name ?? item.object?.name ?? '—'}</span>
                    ),
                    'item.description': ({ item }: any) => (
                      <span class="text-body-2 text-medium-emphasis">{item.description ?? '—'}</span>
                    ),
                    'item.hours': ({ item }: any) => (
                      <strong class="text-primary">{item.hours}г</strong>
                    ),
                    bottom: () => (
                      <tr style="background: rgba(var(--v-theme-primary), 0.05)">
                        <td colspan={6} class="pa-3 text-right font-weight-bold">Разом:</td>
                        <td class="pa-3 text-right">
                          <strong class="text-primary">{Number(u.totalHours).toFixed(2)}г</strong>
                        </td>
                      </tr>
                    ),
                  }}
                </v-data-table>
              </>
            )}
          </v-card>
        ))}
      </div>
    )
  },
})
