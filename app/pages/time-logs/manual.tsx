import TimeLogEditorDialog from '../../components/TimeLogEditorDialog'

const TASK_STATUS_UK: Record<string, string> = {
  TODO: 'До виконання',
  IN_PROGRESS: 'В роботі',
  REVIEW: 'На перевірці',
  DONE: 'Виконано',
  CANCELLED: 'Скасовано',
}

const WEEKDAYS_UK = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота']

/** Округлення суми годин, щоб прибрати похибку чисел з плаваючою комою. */
function roundHours(value: number) {
  return Math.round(value * 100) / 100
}

export default defineComponent({
  name: 'WorkJournalPage',
  setup() {
    definePageMeta({ middleware: ['auth', 'admin'] })
    useHead({ title: 'Журнал робіт' })

    const toast = useToast()

    const listQuery = reactive({
      userId: '' as string,
      objectId: '' as string,
      warehouseId: '' as string,
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
          ...(listQuery.warehouseId && { warehouseId: listQuery.warehouseId }),
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

    const logs = computed<any[]>(() => (listData.value as any)?.logs ?? [])

    /** Записи поточної сторінки, згруповані по днях (як у щоденному журналі робіт). */
    const dayGroups = computed(() => {
      const map = new Map<string, { date: string; logs: any[]; totalHours: number }>()
      for (const log of logs.value) {
        const key = new Date(log.date).toISOString().slice(0, 10)
        let group = map.get(key)
        if (!group) {
          group = { date: key, logs: [], totalHours: 0 }
          map.set(key, group)
        }
        group.logs.push(log)
        group.totalHours += Number(log.hours) || 0
      }
      return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date))
    })

    const pageTotalHours = computed(() =>
      roundHours(logs.value.reduce((sum, log) => sum + (Number(log.hours) || 0), 0)),
    )

    const { data: usersData } = useFetch('/api/users/list')
    const users = computed(() => (usersData.value as any[]) ?? [])

    const { data: objectsData } = useFetch('/api/objects')
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])

    const { data: warehousesData } = useFetch('/api/warehouses')
    const warehouses = computed(() => (warehousesData.value as any)?.warehouses ?? [])

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
      const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      return `${WEEKDAYS_UK[date.getDay()]}, ${date.toLocaleDateString('uk-UA')}`
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

    function rowActions(log: any) {
      return (
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
      )
    }

    function renderJournalRows() {
      const rows: any[] = []
      for (const group of dayGroups.value) {
        rows.push(
          <tr key={`day-${group.date}`}>
            <td colspan={6} style={{ background: 'rgba(var(--v-theme-on-surface), 0.045)' }}>
              <div class="d-flex align-center flex-wrap gap-2 py-1">
                <v-icon size="small" icon="mdi-calendar-blank-outline" class="text-medium-emphasis" />
                <span class="font-weight-bold">{formatDayHeader(group.date)}</span>
                <v-spacer />
                <span class="text-caption text-medium-emphasis">{group.logs.length} зап.</span>
                <v-chip size="small" color="primary" variant="tonal">
                  Σ {roundHours(group.totalHours)} год
                </v-chip>
                <v-btn
                  size="small"
                  variant="tonal"
                  prepend-icon="mdi-calendar-search"
                  to={`/time-logs/day?date=${group.date}`}
                >
                  День
                </v-btn>
              </div>
            </td>
          </tr>,
        )
        for (const log of group.logs) {
          rows.push(
            <tr key={log.id}>
              <td class="font-weight-medium">{log.user?.name ?? '—'}</td>
              <td>{locationCell(log)}</td>
              <td>{taskCell(log)}</td>
              <td class="text-end"><strong>{log.hours} год</strong></td>
              <td>
                <span class="text-body-2 text-medium-emphasis">{log.description || '—'}</span>
              </td>
              {rowActions(log)}
            </tr>,
          )
        }
      }
      return rows
    }

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Журнал робіт</div>
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
            Додати запис
          </v-btn>
          <v-btn variant="outlined" prepend-icon="mdi-arrow-left" to="/tasks" size="small">
            До завдань
          </v-btn>
        </div>

        <v-alert type="info" variant="tonal" class="mb-4" density="compact">
          Щоденний облік робіт: хто з працівників, на якому обʼєкті чи складі та скільки годин
          працював. Кнопка «День» відкриває детальну сторінку конкретної дати. Записи без завдання
          одразу враховуються в зарплатному звіті та репорті обʼєкта; із завданням — після статусу
          «Виконано».
        </v-alert>

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
          <v-card-title class="text-subtitle-1">Фільтри</v-card-title>
          <v-card-text class="pb-2">
            <v-row dense>
              <v-col cols={12} sm={6} md={3}>
                <v-select
                  v-model={listQuery.userId}
                  label="Працівник"
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
              <v-col cols={12} sm={6} md={3}>
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
                <v-select
                  v-model={listQuery.warehouseId}
                  label="Склад"
                  items={[{ value: '', title: 'Усі' }, ...warehouses.value.map((w: any) => ({ value: w.id, title: w.name }))]}
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
          {listPending.value && <v-progress-linear indeterminate color="primary" />}

          {!listPending.value && logs.value.length === 0 ? (
            <div class="pa-8 text-center text-medium-emphasis">
              <v-icon size="48" icon="mdi-calendar-remove-outline" class="mb-2" />
              <div>Записів не знайдено. Змініть фільтри або додайте запис.</div>
            </div>
          ) : (
            <v-table density="comfortable" class="journal-table">
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Працівник</th>
                  <th>Обʼєкт / Склад</th>
                  <th>Завдання</th>
                  <th class="text-end" style={{ width: '110px' }}>Години</th>
                  <th>Опис робіт</th>
                  <th style={{ width: '140px' }} />
                </tr>
              </thead>
              <tbody>{renderJournalRows()}</tbody>
            </v-table>
          )}

          <v-divider />
          <div class="d-flex align-center justify-center pa-3 gap-3 flex-wrap">
            <v-pagination
              v-model={listQuery.page}
              length={totalPages.value}
              total-visible={7}
              size="small"
              disabled={listPending.value}
            />
            <v-chip size="small" variant="tonal" color="primary">
              На сторінці: {pageTotalHours.value} год
            </v-chip>
            <span class="text-caption text-medium-emphasis">
              Всього записів: {(listData.value as any)?.total ?? 0}
            </span>
          </div>
        </v-card>

        <TimeLogEditorDialog
          open={editorOpen.value}
          log={editorLog.value}
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
