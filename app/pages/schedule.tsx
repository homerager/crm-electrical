const TYPES = [
  { value: 'WORK', label: 'Робота', color: 'primary', icon: 'mdi-hammer-wrench' },
  { value: 'DAY_OFF', label: 'Вихідний', color: 'grey', icon: 'mdi-coffee-outline' },
  { value: 'VACATION', label: 'Відпустка', color: 'success', icon: 'mdi-beach' },
  { value: 'SICK_LEAVE', label: 'Лікарняний', color: 'warning', icon: 'mdi-hospital-box-outline' },
]

const SHIFTS = [
  { value: 'FULL_DAY', label: 'Повний день', defaultHours: 8 },
  { value: 'MORNING', label: 'Ранкова зміна', defaultHours: 4 },
  { value: 'AFTERNOON', label: 'Денна зміна', defaultHours: 4 },
]

const SHIFT_DEFAULT_HOURS: Record<string, number> = Object.fromEntries(SHIFTS.map((s) => [s.value, s.defaultHours]))

const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPES.map((t) => [t.value, t.label]))
const TYPE_COLORS: Record<string, string> = Object.fromEntries(TYPES.map((t) => [t.value, t.color]))
const TYPE_ICONS: Record<string, string> = Object.fromEntries(TYPES.map((t) => [t.value, t.icon]))
const SHIFT_LABELS: Record<string, string> = Object.fromEntries(SHIFTS.map((s) => [s.value, s.label]))

export default defineComponent({
  name: 'SchedulePage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Розклад' })

    const { isPrivileged, isEmployee } = useAuth()

    const viewMode = ref<'calendar' | 'table'>('calendar')
    const colorBy = ref<'type' | 'user'>('type')
    const filterUserId = ref('')
    const filterObjectId = ref('')
    const filterType = ref('')

    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0)

    const filterDateFrom = ref(monthStart.toISOString().slice(0, 10))
    const filterDateTo = ref(monthEnd.toISOString().slice(0, 10))

    const { data: objectsData } = useFetch('/api/objects', { skip: () => isEmployee.value })
    const { data: usersData } = useFetch(
      computed(() => (isPrivileged.value ? '/api/users' : '/api/users/list')),
      { skip: () => isEmployee.value },
    )

    const objects = computed(() => (objectsData.value as any)?.objects ?? [])
    const users = computed(() => {
      const v = usersData.value as any
      if (Array.isArray(v)) return v
      return v?.users ?? []
    })

    const { data: schedulesData, refresh, pending } = useFetch('/api/schedules', {
      query: computed(() => ({
        ...(filterUserId.value && { userId: filterUserId.value }),
        ...(filterObjectId.value && { objectId: filterObjectId.value }),
        ...(filterType.value && { type: filterType.value }),
        ...(filterDateFrom.value && { dateFrom: filterDateFrom.value }),
        ...(filterDateTo.value && { dateTo: filterDateTo.value }),
      })),
    })

    const schedules = computed(() => (schedulesData.value as any)?.schedules ?? [])

    const dialog = ref(false)
    const editMode = ref(false)
    const editId = ref('')
    const saving = ref(false)
    const error = ref('')

    const deleteDialog = ref(false)
    const deleteTarget = ref<any>(null)
    const deleting = ref(false)

    const conflictsDialog = ref(false)
    const conflicts = ref<any[]>([])
    const conflictsLoading = ref(false)

    const form = reactive({
      userId: '',
      objectId: '',
      date: new Date().toISOString().slice(0, 10),
      type: 'WORK' as string,
      shift: 'FULL_DAY' as string,
      hours: '' as string,
      description: '',
    })

    const hoursPlaceholder = computed(() => {
      return String(SHIFT_DEFAULT_HOURS[form.shift] ?? 8)
    })

    function resetForm() {
      Object.assign(form, {
        userId: '',
        objectId: '',
        date: new Date().toISOString().slice(0, 10),
        type: 'WORK',
        shift: 'FULL_DAY',
        hours: '',
        description: '',
      })
    }

    function openCreate(prefillDate?: string) {
      editMode.value = false
      editId.value = ''
      resetForm()
      if (prefillDate) form.date = prefillDate
      error.value = ''
      dialog.value = true
    }

    function openEdit(entry: any) {
      editMode.value = true
      editId.value = entry.id
      Object.assign(form, {
        userId: entry.userId,
        objectId: entry.objectId || '',
        date: new Date(entry.date).toISOString().slice(0, 10),
        type: entry.type,
        shift: entry.shift,
        hours: entry.hours != null ? String(entry.hours) : '',
        description: entry.description || '',
      })
      error.value = ''
      dialog.value = true
    }

    async function save() {
      saving.value = true
      error.value = ''
      try {
        const payload = {
          ...form,
          objectId: form.type === 'WORK' ? (form.objectId || null) : null,
          hours: form.hours ? Number(form.hours) : null,
        }
        if (editMode.value) {
          await $fetch(`/api/schedules/${editId.value}`, { method: 'PUT', body: payload })
        } else {
          await $fetch('/api/schedules', { method: 'POST', body: payload })
        }
        dialog.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        saving.value = false
      }
    }

    function openDelete(entry: any) {
      deleteTarget.value = entry
      deleteDialog.value = true
    }

    async function confirmDelete() {
      if (!deleteTarget.value) return
      deleting.value = true
      try {
        await $fetch(`/api/schedules/${deleteTarget.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        deleteTarget.value = null
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка видалення'
      } finally {
        deleting.value = false
      }
    }

    async function handleDrop(id: string, newDate: string) {
      await $fetch(`/api/schedules/${id}`, { method: 'PUT', body: { date: newDate } })
      await refresh()
    }

    function handleEntryClick(id: string) {
      const entry = schedules.value.find((s: any) => s.id === id)
      if (entry && isPrivileged.value) openEdit(entry)
    }

    function handleDateSelect(date: string) {
      if (isPrivileged.value) openCreate(date)
    }

    async function checkConflicts() {
      conflictsLoading.value = true
      try {
        const data = await $fetch<any>('/api/schedules/conflicts', {
          query: {
            ...(filterDateFrom.value && { dateFrom: filterDateFrom.value }),
            ...(filterDateTo.value && { dateTo: filterDateTo.value }),
          },
        })
        conflicts.value = data.conflicts ?? []
        conflictsDialog.value = true
      } catch {
        conflicts.value = []
      } finally {
        conflictsLoading.value = false
      }
    }

    function formatDate(d: string | null) {
      if (!d) return '—'
      return new Date(d).toLocaleDateString('uk-UA')
    }

    function effectiveHours(entry: any): number {
      if (entry.hours != null) return entry.hours
      return SHIFT_DEFAULT_HOURS[entry.shift] ?? 8
    }

    const stats = computed(() => {
      const items = schedules.value as any[]
      const work = items.filter((s) => s.type === 'WORK').length
      const off = items.filter((s) => s.type === 'DAY_OFF').length
      const vacation = items.filter((s) => s.type === 'VACATION').length
      const sick = items.filter((s) => s.type === 'SICK_LEAVE').length
      const uniqueUsers = new Set(items.map((s) => s.userId)).size
      const totalHours = items
        .filter((s) => s.type === 'WORK')
        .reduce((sum, s) => sum + effectiveHours(s), 0)
      return { work, off, vacation, sick, uniqueUsers, total: items.length, totalHours }
    })

    const hasFilters = computed(() =>
      filterUserId.value || filterObjectId.value || filterType.value,
    )

    const headers = computed(() => {
      const cols = [
        { title: 'Дата', key: 'date', width: 110 },
        { title: 'Працівник', key: 'user', minWidth: 160 },
        { title: 'Тип', key: 'type', width: 140 },
        { title: 'Зміна', key: 'shift', width: 140 },
        { title: 'Години', key: 'hours', width: 90, align: 'center' as const },
        { title: 'Обʼєкт', key: 'object', minWidth: 160 },
        { title: 'Опис', key: 'description', minWidth: 150 },
      ]
      if (isPrivileged.value) {
        cols.push({ title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 100 } as any)
      }
      return cols
    })

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">
            {isEmployee.value ? 'Мій розклад' : 'Розклад бригад'}
          </div>
          <v-spacer />
          {isPrivileged.value && (
            <>
              <v-btn
                variant="outlined"
                size="small"
                prepend-icon="mdi-alert-circle-outline"
                color="warning"
                loading={conflictsLoading.value}
                onClick={checkConflicts}
              >
                Конфлікти
              </v-btn>
              <v-btn color="primary" prepend-icon="mdi-plus" onClick={() => openCreate()}>
                Новий запис
              </v-btn>
            </>
          )}
        </div>

        {/* Stats */}
        <v-row class="mb-4">
          <v-col cols={12} sm={6} md={2}>
            <v-card class="pa-4">
              <div class="text-caption text-medium-emphasis">Працівників</div>
              <div class="text-h6 font-weight-bold">{stats.value.uniqueUsers}</div>
            </v-card>
          </v-col>
          <v-col cols={12} sm={6} md={2}>
            <v-card class="pa-4">
              <div class="text-caption text-medium-emphasis">Робочих днів</div>
              <div class="text-h6 font-weight-bold text-primary">{stats.value.work}</div>
            </v-card>
          </v-col>
          <v-col cols={12} sm={6} md={2}>
            <v-card class="pa-4">
              <div class="text-caption text-medium-emphasis">Вихідних</div>
              <div class="text-h6 font-weight-bold">{stats.value.off}</div>
            </v-card>
          </v-col>
          <v-col cols={12} sm={6} md={2}>
            <v-card class="pa-4">
              <div class="text-caption text-medium-emphasis">Відпусток</div>
              <div class="text-h6 font-weight-bold text-success">{stats.value.vacation}</div>
            </v-card>
          </v-col>
          <v-col cols={12} sm={6} md={2}>
            <v-card class="pa-4">
              <div class="text-caption text-medium-emphasis">Лікарняних</div>
              <div class="text-h6 font-weight-bold text-warning">{stats.value.sick}</div>
            </v-card>
          </v-col>
          <v-col cols={12} sm={6} md={2}>
            <v-card class="pa-4">
              <div class="text-caption text-medium-emphasis">Робочих годин</div>
              <div class="text-h6 font-weight-bold text-info">{stats.value.totalHours} год</div>
            </v-card>
          </v-col>
        </v-row>

        {/* Filters */}
        <v-card class="mb-4 pa-4">
          <v-row dense align="center">
            {!isEmployee.value && (
              <v-col cols={12} sm={6} md={2}>
                <v-autocomplete
                  v-model={filterUserId.value}
                  label="Працівник"
                  items={[{ value: '', title: 'Всі' }, ...users.value.map((u: any) => ({ value: u.id, title: u.name }))]}
                  density="compact"
                  clearable
                  hide-details
                />
              </v-col>
            )}
            {!isEmployee.value && (
              <v-col cols={12} sm={6} md={2}>
                <v-autocomplete
                  v-model={filterObjectId.value}
                  label="Обʼєкт"
                  items={[{ value: '', title: 'Всі' }, ...objects.value.map((o: any) => ({ value: o.id, title: o.name }))]}
                  density="compact"
                  clearable
                  hide-details
                />
              </v-col>
            )}
            <v-col cols={12} sm={6} md={2}>
              <v-select
                v-model={filterType.value}
                label="Тип"
                items={[{ value: '', title: 'Всі' }, ...TYPES.map((t) => ({ value: t.value, title: t.label }))]}
                density="compact"
                clearable
                hide-details
              />
            </v-col>
            <v-col cols={12} sm={6} md={2}>
              <v-text-field
                v-model={filterDateFrom.value}
                label="Від"
                type="date"
                density="compact"
                clearable
                hide-details
              />
            </v-col>
            <v-col cols={12} sm={6} md={2}>
              <v-text-field
                v-model={filterDateTo.value}
                label="До"
                type="date"
                density="compact"
                clearable
                hide-details
              />
            </v-col>
            <v-col cols={12} sm={6} md={2} class="d-flex align-center gap-2">
              <v-btn-toggle
                modelValue={viewMode.value}
                onUpdate:modelValue={(v: 'calendar' | 'table') => { if (v) viewMode.value = v }}
                variant="outlined"
                density="compact"
                mandatory
                divided
              >
                <v-btn value="calendar" size="small" icon="mdi-calendar-month-outline" />
                <v-btn value="table" size="small" icon="mdi-table" />
              </v-btn-toggle>
              {viewMode.value === 'calendar' && !isEmployee.value && (
                <v-btn-toggle
                  modelValue={colorBy.value}
                  onUpdate:modelValue={(v: 'type' | 'user') => { if (v) colorBy.value = v }}
                  variant="outlined"
                  density="compact"
                  mandatory
                  divided
                >
                  <v-btn value="type" size="small" class="text-none px-2">Тип</v-btn>
                  <v-btn value="user" size="small" class="text-none px-2">Працівник</v-btn>
                </v-btn-toggle>
              )}
              {hasFilters.value && (
                <v-btn
                  variant="text"
                  size="small"
                  color="error"
                  icon="mdi-filter-remove"
                  onClick={() => {
                    filterUserId.value = ''
                    filterObjectId.value = ''
                    filterType.value = ''
                  }}
                />
              )}
            </v-col>
          </v-row>
        </v-card>

        {/* Legend */}
        {viewMode.value === 'calendar' && colorBy.value === 'type' && (
          <div class="d-flex flex-wrap align-center gap-2 mb-4">
            {TYPES.map((t) => (
              <v-chip
                key={t.value}
                size="small"
                label
                color={t.color}
                variant="flat"
                prepend-icon={t.icon}
              >
                {t.label}
              </v-chip>
            ))}
            <v-spacer />
            <v-chip size="small" color="primary" variant="tonal" prepend-icon="mdi-calendar-check-outline">
              {schedules.value.length} записів
            </v-chip>
          </div>
        )}

        {/* Calendar view */}
        {viewMode.value === 'calendar' && (
          <v-card elevation={1}>
            <v-card-text class="pa-3 pa-sm-4">
              <ScheduleCalendarWidget
                schedules={schedules.value}
                colorBy={colorBy.value}
                onEntryClick={handleEntryClick}
                onDateSelect={isPrivileged.value ? handleDateSelect : undefined}
                onDrop={isPrivileged.value ? handleDrop : undefined}
              />
            </v-card-text>
          </v-card>
        )}

        {/* Table view */}
        {viewMode.value === 'table' && (
          <v-card>
            <v-data-table headers={headers.value} items={schedules.value} loading={pending.value} hover items-per-page={25}>
              {{
                'item.date': ({ item }: any) => formatDate(item.date),
                'item.user': ({ item }: any) => (
                  <div>
                    <div class="font-weight-medium">{item.user?.name}</div>
                    {item.user?.jobTitle?.name && (
                      <div class="text-caption text-medium-emphasis">{item.user.jobTitle.name}</div>
                    )}
                  </div>
                ),
                'item.type': ({ item }: any) => (
                  <v-chip
                    size="small"
                    color={TYPE_COLORS[item.type] ?? 'grey'}
                    variant="tonal"
                    prepend-icon={TYPE_ICONS[item.type] ?? 'mdi-help'}
                  >
                    {TYPE_LABELS[item.type] ?? item.type}
                  </v-chip>
                ),
                'item.shift': ({ item }: any) => SHIFT_LABELS[item.shift] ?? item.shift,
                'item.hours': ({ item }: any) => {
                  const h = effectiveHours(item)
                  const isCustom = item.hours != null
                  return (
                    <span class={isCustom ? 'font-weight-bold' : 'text-medium-emphasis'}>
                      {h} год
                    </span>
                  )
                },
                'item.object': ({ item }: any) => item.object?.name || '—',
                'item.description': ({ item }: any) => (
                  <span class="text-truncate d-inline-block" style={{ maxWidth: '200px' }}>
                    {item.description || '—'}
                  </span>
                ),
                'item.actions': ({ item }: any) =>
                  isPrivileged.value
                    ? (
                        <div class="d-flex gap-1 justify-end">
                          <v-btn icon="mdi-pencil" variant="text" size="small" onClick={() => openEdit(item)} />
                          <v-btn icon="mdi-delete" variant="text" size="small" color="error" onClick={() => openDelete(item)} />
                        </div>
                      )
                    : null,
              }}
            </v-data-table>
          </v-card>
        )}

        {/* Create/Edit dialog */}
        <v-dialog v-model={dialog.value} max-width={600}>
          <v-card>
            <v-card-title class="pa-4">
              {editMode.value ? 'Редагувати запис' : 'Новий запис розкладу'}
            </v-card-title>
            <v-card-text class="pa-5 pt-2">
              {error.value && <v-alert type="error" variant="tonal" class="mb-4">{error.value}</v-alert>}

              <v-row dense>
                <v-col cols={12} sm={6}>
                  <v-autocomplete
                    v-model={form.userId}
                    label="Працівник *"
                    items={users.value.map((u: any) => ({ value: u.id, title: u.name }))}
                    density="comfortable"
                  />
                </v-col>
                <v-col cols={12} sm={6}>
                  <v-text-field
                    v-model={form.date}
                    label="Дата *"
                    type="date"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols={12} sm={6}>
                  <v-select
                    v-model={form.type}
                    label="Тип *"
                    items={TYPES.map((t) => ({ value: t.value, title: t.label }))}
                    density="comfortable"
                  />
                </v-col>
                <v-col cols={12} sm={6}>
                  <v-select
                    v-model={form.shift}
                    label="Зміна"
                    items={SHIFTS.map((s) => ({ value: s.value, title: s.label }))}
                    density="comfortable"
                  />
                </v-col>
                <v-col cols={12} sm={6}>
                  <v-text-field
                    v-model={form.hours}
                    label="Години"
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    placeholder={hoursPlaceholder.value}
                    persistent-placeholder
                    hint={`За замовчуванням: ${hoursPlaceholder.value} год`}
                    persistent-hint
                    density="comfortable"
                  />
                </v-col>
                <v-col cols={12} sm={6} />
                {form.type === 'WORK' && (
                  <v-col cols={12}>
                    <v-autocomplete
                      v-model={form.objectId}
                      label="Обʼєкт *"
                      items={objects.value.map((o: any) => ({ value: o.id, title: o.name }))}
                      density="comfortable"
                    />
                  </v-col>
                )}
                <v-col cols={12}>
                  <v-textarea
                    v-model={form.description}
                    label="Опис"
                    rows={2}
                    auto-grow
                    density="comfortable"
                  />
                </v-col>
              </v-row>
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (dialog.value = false)}>Скасувати</v-btn>
              <v-btn
                color="primary"
                variant="elevated"
                loading={saving.value}
                disabled={!form.userId || !form.date || (form.type === 'WORK' && !form.objectId)}
                onClick={save}
              >
                {editMode.value ? 'Зберегти' : 'Створити'}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        {/* Delete dialog */}
        <v-dialog v-model={deleteDialog.value} max-width={420}>
          <v-card>
            <v-card-title>Видалити запис?</v-card-title>
            <v-card-text>
              Запис розкладу для <strong>{deleteTarget.value?.user?.name}</strong> на{' '}
              <strong>{deleteTarget.value ? formatDate(deleteTarget.value.date) : ''}</strong> буде видалено.
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (deleteDialog.value = false)}>Скасувати</v-btn>
              <v-btn color="error" variant="elevated" loading={deleting.value} onClick={confirmDelete}>
                Видалити
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        {/* Conflicts dialog */}
        <v-dialog v-model={conflictsDialog.value} max-width={700}>
          <v-card>
            <v-card-title class="pa-4 d-flex align-center">
              <v-icon color="warning" class="mr-2">mdi-alert-circle-outline</v-icon>
              Конфлікти розкладу
            </v-card-title>
            <v-card-text class="pa-5 pt-0">
              {conflicts.value.length === 0 ? (
                <v-alert type="success" variant="tonal">
                  Конфліктів не виявлено
                </v-alert>
              ) : (
                <v-list density="compact">
                  {conflicts.value.map((c: any, i: number) => (
                    <v-list-item key={i} class="mb-2">
                      <div>
                        <div class="font-weight-medium">
                          {c.userName} — {formatDate(c.date)}
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          {c.entries.map((e: any) => {
                            const label = TYPE_LABELS[e.type] ?? e.type
                            const shift = SHIFT_LABELS[e.shift] ?? e.shift
                            const obj = e.object?.name ? ` → ${e.object.name}` : ''
                            return `${label} (${shift})${obj}`
                          }).join(' | ')}
                        </div>
                      </div>
                    </v-list-item>
                  ))}
                </v-list>
              )}
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (conflictsDialog.value = false)}>Закрити</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
