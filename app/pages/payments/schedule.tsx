const SCHEDULE_STATUSES = [
  { value: 'EXPECTED', label: 'Очікується', color: 'info', icon: 'mdi-clock-outline' },
  { value: 'PAID', label: 'Оплачено', color: 'success', icon: 'mdi-check-circle-outline' },
  { value: 'OVERDUE', label: 'Прострочено', color: 'error', icon: 'mdi-alert-circle-outline' },
  { value: 'CANCELLED', label: 'Скасовано', color: 'grey', icon: 'mdi-close-circle-outline' },
]

function scheduleStatusMeta(val: string) {
  return SCHEDULE_STATUSES.find((s) => s.value === val) ?? SCHEDULE_STATUSES[0]
}

export default defineComponent({
  name: 'PaymentSchedulePage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Графік платежів' })

    const { isPrivileged } = useAuth()

    const filterObjectId = ref('')
    const filterStatus = ref('')

    const { data: objectsData } = useFetch('/api/objects')
    const { data: clientsData } = useFetch('/api/clients')

    const objects = computed(() => (objectsData.value as any)?.objects ?? [])
    const clients = computed(() => (clientsData.value as any)?.clients ?? [])

    const { data: schedulesData, refresh, pending } = useFetch('/api/payment-schedules', {
      query: computed(() => ({
        ...(filterObjectId.value && { objectId: filterObjectId.value }),
        ...(filterStatus.value && { status: filterStatus.value }),
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

    const form = reactive({
      objectId: '',
      clientId: '',
      amount: '',
      dueDate: '',
      description: '',
    })

    function openCreate() {
      editMode.value = false
      editId.value = ''
      Object.assign(form, {
        objectId: '',
        clientId: '',
        amount: '',
        dueDate: '',
        description: '',
      })
      error.value = ''
      dialog.value = true
    }

    function openEdit(schedule: any) {
      editMode.value = true
      editId.value = schedule.id
      Object.assign(form, {
        objectId: schedule.objectId || '',
        clientId: schedule.clientId || '',
        amount: String(Number(schedule.amount)),
        dueDate: new Date(schedule.dueDate).toISOString().slice(0, 10),
        description: schedule.description || '',
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
          amount: Number(form.amount),
          clientId: form.clientId || null,
        }
        if (editMode.value) {
          await $fetch(`/api/payment-schedules/${editId.value}`, { method: 'PUT', body: payload })
        } else {
          await $fetch('/api/payment-schedules', { method: 'POST', body: payload })
        }
        dialog.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        saving.value = false
      }
    }

    async function changeStatus(schedule: any, newStatus: string) {
      try {
        await $fetch(`/api/payment-schedules/${schedule.id}`, {
          method: 'PUT',
          body: { status: newStatus },
        })
        await refresh()
      } catch {}
    }

    function openDelete(schedule: any) {
      deleteTarget.value = schedule
      deleteDialog.value = true
    }

    async function confirmDelete() {
      if (!deleteTarget.value) return
      deleting.value = true
      try {
        await $fetch(`/api/payment-schedules/${deleteTarget.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        deleteTarget.value = null
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка видалення'
      } finally {
        deleting.value = false
      }
    }

    function formatCurrency(val: number | string) {
      return Number(val).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₴'
    }

    function formatDate(d: string | null) {
      if (!d) return '—'
      return new Date(d).toLocaleDateString('uk-UA')
    }

    function isOverdue(schedule: any) {
      return schedule.status === 'EXPECTED' && new Date(schedule.dueDate) < new Date()
    }

    const totalExpected = computed(() =>
      schedules.value
        .filter((s: any) => s.status === 'EXPECTED')
        .reduce((sum: number, s: any) => sum + Number(s.amount), 0),
    )
    const totalOverdue = computed(() =>
      schedules.value
        .filter((s: any) => isOverdue(s))
        .reduce((sum: number, s: any) => sum + Number(s.amount), 0),
    )

    const headers = [
      { title: 'Дата', key: 'dueDate', width: 120 },
      { title: 'Сума', key: 'amount', width: 140 },
      { title: 'Статус', key: 'status', width: 140 },
      { title: 'Обʼєкт', key: 'object', minWidth: 180 },
      { title: 'Клієнт', key: 'client', minWidth: 160 },
      { title: 'Опис', key: 'description', minWidth: 150 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 150 },
    ]

    return () => (
      <div>
        <div class="page-toolbar">
          <v-btn variant="text" icon="mdi-arrow-left" to="/payments" />
          <div class="text-h5 font-weight-bold">Графік платежів</div>
          <v-spacer />
          {isPrivileged.value && (
            <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
              Додати платіж
            </v-btn>
          )}
        </div>

        {/* Summary */}
        <v-row class="mb-4">
          <v-col cols={12} sm={6} md={4}>
            <v-card class="pa-4">
              <div class="text-caption text-medium-emphasis">Очікувані платежі</div>
              <div class="text-h6 font-weight-bold text-info">{formatCurrency(totalExpected.value)}</div>
            </v-card>
          </v-col>
          <v-col cols={12} sm={6} md={4}>
            <v-card class="pa-4">
              <div class="text-caption text-medium-emphasis">Прострочено</div>
              <div class={`text-h6 font-weight-bold ${totalOverdue.value > 0 ? 'text-error' : 'text-success'}`}>
                {formatCurrency(totalOverdue.value)}
              </div>
            </v-card>
          </v-col>
        </v-row>

        {/* Filters */}
        <v-card class="mb-4 pa-4">
          <v-row dense>
            <v-col cols={12} sm={6} md={4}>
              <v-select
                v-model={filterObjectId.value}
                label="Обʼєкт"
                items={[{ value: '', title: 'Всі' }, ...objects.value.map((o: any) => ({ value: o.id, title: o.name }))]}
                density="compact"
                clearable
                hide-details
              />
            </v-col>
            <v-col cols={12} sm={6} md={4}>
              <v-select
                v-model={filterStatus.value}
                label="Статус"
                items={[{ value: '', title: 'Всі' }, ...SCHEDULE_STATUSES.map((s) => ({ value: s.value, title: s.label }))]}
                density="compact"
                clearable
                hide-details
              />
            </v-col>
          </v-row>
        </v-card>

        {/* Table */}
        <v-card>
          <v-data-table headers={headers} items={schedules.value} loading={pending.value} hover items-per-page={25}>
            {{
              'item.dueDate': ({ item }: any) => (
                <span class={isOverdue(item) ? 'text-error font-weight-bold' : ''}>
                  {formatDate(item.dueDate)}
                  {isOverdue(item) && <v-icon size="small" color="error" class="ml-1">mdi-alert</v-icon>}
                </span>
              ),
              'item.amount': ({ item }: any) => (
                <span class="font-weight-bold">{formatCurrency(item.amount)}</span>
              ),
              'item.status': ({ item }: any) => {
                const s = scheduleStatusMeta(isOverdue(item) ? 'OVERDUE' : item.status)
                return (
                  <v-chip size="small" color={s.color} variant="tonal" prepend-icon={s.icon}>
                    {s.label}
                  </v-chip>
                )
              },
              'item.object': ({ item }: any) => item.object?.name || '—',
              'item.client': ({ item }: any) => item.client?.name || '—',
              'item.description': ({ item }: any) => (
                <span class="text-truncate d-inline-block" style={{ maxWidth: '200px' }}>
                  {item.description || '—'}
                </span>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end">
                  {item.status === 'EXPECTED' && (
                    <v-btn
                      icon="mdi-check"
                      variant="text"
                      size="small"
                      color="success"
                      title="Позначити оплаченим"
                      onClick={() => changeStatus(item, 'PAID')}
                    />
                  )}
                  <v-btn icon="mdi-pencil" variant="text" size="small" onClick={() => openEdit(item)} />
                  <v-btn icon="mdi-delete" variant="text" size="small" color="error" onClick={() => openDelete(item)} />
                </div>
              ),
            }}
          </v-data-table>
        </v-card>

        {/* Create/Edit dialog */}
        <v-dialog v-model={dialog.value} max-width={520}>
          <v-card>
            <v-card-title class="pa-4">
              {editMode.value ? 'Редагувати запис' : 'Новий запланований платіж'}
            </v-card-title>
            <v-card-text class="pa-5 pt-2">
              {error.value && <v-alert type="error" variant="tonal" class="mb-4">{error.value}</v-alert>}

              <v-select
                v-model={form.objectId}
                label="Обʼєкт *"
                items={objects.value.map((o: any) => ({ value: o.id, title: o.name }))}
                class="mb-4"
              />
              <v-select
                v-model={form.clientId}
                label="Клієнт"
                items={[{ value: '', title: '—' }, ...clients.value.map((c: any) => ({ value: c.id, title: c.name }))]}
                clearable
                class="mb-4"
              />
              <div class="d-flex gap-4 mb-4">
                <v-text-field
                  v-model={form.amount}
                  label="Сума (грн) *"
                  type="number"
                  min="0.01"
                  step="0.01"
                  style="flex:1"
                />
                <v-text-field
                  v-model={form.dueDate}
                  label="Дата платежу *"
                  type="date"
                  style="flex:1"
                />
              </div>
              <v-textarea
                v-model={form.description}
                label="Опис"
                rows={2}
                auto-grow
              />
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (dialog.value = false)}>Скасувати</v-btn>
              <v-btn
                color="primary"
                variant="elevated"
                loading={saving.value}
                disabled={!form.objectId || !form.amount || !form.dueDate}
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
            <v-card-title>Видалити запис графіку?</v-card-title>
            <v-card-text>
              Запланований платіж на суму <strong>{deleteTarget.value ? formatCurrency(deleteTarget.value.amount) : ''}</strong> буде видалено.
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
