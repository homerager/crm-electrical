import TimeLogEditorDialog from '../../components/TimeLogEditorDialog'

const TASK_STATUS_UK: Record<string, string> = {
  TODO: 'До виконання',
  IN_PROGRESS: 'В роботі',
  REVIEW: 'На перевірці',
  DONE: 'Виконано',
  CANCELLED: 'Скасовано',
}

const WEEKDAYS_UK = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота']

function roundHours(value: number) {
  return Math.round(value * 100) / 100
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/** Зсуває дату формату YYYY-MM-DD на задану кількість днів. */
function shiftDate(iso: string, days: number) {
  const parts = iso.split('-')
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default defineComponent({
  name: 'WorkJournalDayPage',
  setup() {
    definePageMeta({ middleware: ['auth', 'admin'] })
    useHead({ title: 'Роботи за день' })

    const route = useRoute()
    const toast = useToast()

    /** Активна дата сторінки (з query ?date=, інакше — сьогодні). */
    const date = computed(() => {
      const q = route.query.date
      return typeof q === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayIso()
    })

    function goToDate(iso: string) {
      navigateTo({ path: '/time-logs/day', query: { date: iso } })
    }

    const { data: listData, pending: listPending, refresh: refreshLogs } = useFetch(
      '/api/time-logs',
      {
        query: computed(() => ({ from: date.value, to: date.value, pageSize: 100 })),
      },
    )

    const logs = computed<any[]>(() => {
      const items = ((listData.value as any)?.logs ?? []) as any[]
      return [...items].sort((a, b) =>
        (a.user?.name ?? '').localeCompare(b.user?.name ?? '', 'uk'),
      )
    })

    const totalHours = computed(() =>
      roundHours(logs.value.reduce((sum, log) => sum + (Number(log.hours) || 0), 0)),
    )

    const editorOpen = ref(false)
    const editorLog = ref<any>(null)
    const success = ref('')
    const actionError = ref('')
    const duplicatingId = ref<string | null>(null)
    const deleteOpen = ref(false)
    const deleteRow = ref<any>(null)
    const deleting = ref(false)

    function openCreate() {
      editorLog.value = null
      editorOpen.value = true
    }

    function openEdit(item: any) {
      editorLog.value = item
      editorOpen.value = true
    }

    async function onEditorSaved(kind: 'created' | 'updated') {
      success.value = kind === 'updated' ? 'Запис оновлено' : 'Запис збережено'
      await refreshLogs()
    }

    async function duplicateLog(item: any) {
      actionError.value = ''
      duplicatingId.value = item.id
      try {
        await $fetch(`/api/time-logs/${item.id}/duplicate`, { method: 'POST' })
        success.value = 'Запис продубльовано'
        await refreshLogs()
        toast.success('Запис журналу продубльовано')
      }
      catch (e: any) {
        actionError.value = e?.data?.statusMessage || 'Не вдалося продублювати запис'
        toast.error(actionError.value)
      }
      finally {
        duplicatingId.value = null
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
        toast.success('Запис журналу видалено')
      }
      catch {
        actionError.value = 'Не вдалося видалити запис'
        toast.error(actionError.value)
      }
      finally {
        deleting.value = false
      }
    }

    function formatDayHeader(iso: string) {
      const parts = iso.split('-')
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      return `${WEEKDAYS_UK[d.getDay()]}, ${d.toLocaleDateString('uk-UA')}`
    }

    function locationCell(log: any) {
      if (log.warehouse) {
        return (
          <span class="d-inline-flex align-center text-body-2">
            <v-icon size="small" icon="mdi-warehouse" class="mr-1 text-medium-emphasis" />
            {log.warehouse.name}
            <v-chip size="x-small" variant="tonal" color="info" class="ml-2">склад</v-chip>
          </span>
        )
      }
      const objectName = log.object?.name ?? log.task?.object?.name
      if (objectName) {
        return (
          <span class="d-inline-flex align-center text-body-2">
            <v-icon size="small" icon="mdi-office-building-outline" class="mr-1 text-medium-emphasis" />
            {objectName}
          </span>
        )
      }
      return <span class="text-medium-emphasis">—</span>
    }

    function taskCell(log: any) {
      if (!log.task) {
        return <span class="text-caption text-medium-emphasis">(без завдання)</span>
      }
      return (
        <span class="d-inline-flex align-center text-body-2">
          {log.task.title}
          <v-chip size="x-small" variant="tonal" class="ml-2">
            {TASK_STATUS_UK[log.task.status] ?? log.task.status}
          </v-chip>
        </span>
      )
    }

    return () => (
      <div>
        <div class="page-toolbar">
          <v-btn variant="text" icon="mdi-arrow-left" to="/time-logs/manual" title="До журналу" />
          <div class="text-h5 font-weight-bold">Роботи за день</div>
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
            Додати запис
          </v-btn>
        </div>

        {success.value && (
          <v-alert type="success" variant="tonal" class="mb-4" closable onClick:close={() => (success.value = '')}>
            {success.value}
          </v-alert>
        )}

        {actionError.value && (
          <v-alert type="error" variant="tonal" class="mb-4" closable onClick:close={() => (actionError.value = '')}>
            {actionError.value}
          </v-alert>
        )}

        <v-card class="mb-4">
          <v-card-text>
            <div class="d-flex align-center flex-wrap gap-3">
              <v-btn
                variant="tonal"
                prepend-icon="mdi-chevron-left"
                onClick={() => goToDate(shiftDate(date.value, -1))}
              >
                Попередній
              </v-btn>

              <div class="d-flex align-center gap-2">
                <v-icon icon="mdi-calendar-blank-outline" class="text-medium-emphasis" />
                <span class="text-h6 font-weight-bold">{formatDayHeader(date.value)}</span>
              </div>

              <v-btn
                variant="tonal"
                append-icon="mdi-chevron-right"
                onClick={() => goToDate(shiftDate(date.value, 1))}
              >
                Наступний
              </v-btn>

              <v-spacer />

              <v-text-field
                modelValue={date.value}
                onUpdate:modelValue={(v: string) => v && goToDate(v)}
                label="Перейти до дати"
                type="date"
                density="compact"
                variant="outlined"
                hide-details
                style={{ maxWidth: '190px' }}
              />
              <v-btn variant="text" prepend-icon="mdi-calendar-today" onClick={() => goToDate(todayIso())}>
                Сьогодні
              </v-btn>
            </div>

            <div class="d-flex align-center gap-2 mt-3">
              <v-chip color="primary" variant="tonal" prepend-icon="mdi-clock-outline">
                Усього: {totalHours.value} год
              </v-chip>
              <v-chip variant="tonal" prepend-icon="mdi-format-list-bulleted">
                Записів: {logs.value.length}
              </v-chip>
            </div>
          </v-card-text>
        </v-card>

        <v-card>
          {listPending.value && <v-progress-linear indeterminate color="primary" />}

          {!listPending.value && logs.value.length === 0 ? (
            <div class="pa-8 text-center text-medium-emphasis">
              <v-icon size="48" icon="mdi-calendar-remove-outline" class="mb-2" />
              <div>На цей день записів немає. Натисніть «Додати запис».</div>
            </div>
          ) : (
            <v-table density="comfortable">
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>Працівник</th>
                  <th>Обʼєкт / Склад</th>
                  <th>Завдання</th>
                  <th class="text-end" style={{ width: '110px' }}>Години</th>
                  <th>Опис робіт</th>
                  <th style={{ width: '140px' }} />
                </tr>
              </thead>
              <tbody>
                {logs.value.map((log: any) => (
                  <tr key={log.id}>
                    <td class="font-weight-medium">{log.user?.name ?? '—'}</td>
                    <td>{locationCell(log)}</td>
                    <td>{taskCell(log)}</td>
                    <td class="text-end"><strong>{log.hours} год</strong></td>
                    <td>
                      <span class="text-body-2 text-medium-emphasis">{log.description || '—'}</span>
                    </td>
                    <td class="text-end" style={{ whiteSpace: 'nowrap' }}>
                      <v-btn
                        icon="mdi-content-copy"
                        size="small"
                        variant="text"
                        color="secondary"
                        title="Дублювати запис"
                        loading={duplicatingId.value === log.id}
                        onClick={() => duplicateLog(log)}
                      />
                      <v-btn
                        icon="mdi-pencil"
                        size="small"
                        variant="text"
                        color="primary"
                        title="Редагувати"
                        onClick={() => openEdit(log)}
                      />
                      <v-btn
                        icon="mdi-delete"
                        size="small"
                        variant="text"
                        color="error"
                        title="Видалити"
                        onClick={() => {
                          deleteRow.value = log
                          deleteOpen.value = true
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </v-table>
          )}
        </v-card>

        <TimeLogEditorDialog
          open={editorOpen.value}
          log={editorLog.value}
          defaultDate={date.value}
          onUpdate:open={(v: boolean) => (editorOpen.value = v)}
          onSaved={onEditorSaved}
        />

        <v-dialog v-model={deleteOpen.value} max-width={400}>
          {deleteRow.value && (
            <v-card>
              <v-card-title>Видалити запис?</v-card-title>
              <v-card-text>
                {new Date(deleteRow.value.date).toLocaleDateString('uk-UA')} ·{' '}
                {deleteRow.value.user?.name} · {deleteRow.value.hours} год
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
