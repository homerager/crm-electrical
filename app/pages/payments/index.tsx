const DIRECTIONS = [
  { value: 'INCOMING', label: 'Вхідна', color: 'success', icon: 'mdi-arrow-down-bold' },
  { value: 'OUTGOING', label: 'Вихідна', color: 'error', icon: 'mdi-arrow-up-bold' },
]

const STATUSES = [
  { value: 'PENDING', label: 'Очікується', color: 'warning', icon: 'mdi-clock-outline' },
  { value: 'COMPLETED', label: 'Проведена', color: 'success', icon: 'mdi-check-circle-outline' },
  { value: 'CANCELLED', label: 'Скасована', color: 'grey', icon: 'mdi-close-circle-outline' },
]

const METHODS = [
  { value: 'BANK_TRANSFER', label: 'Безготівковий' },
  { value: 'CASH', label: 'Готівка' },
  { value: 'CARD', label: 'Картка' },
  { value: 'OTHER', label: 'Інше' },
]

function directionMeta(val: string) {
  return DIRECTIONS.find((d) => d.value === val) ?? DIRECTIONS[0]
}
function statusMeta(val: string) {
  return STATUSES.find((s) => s.value === val) ?? STATUSES[0]
}
function methodLabel(val: string) {
  return METHODS.find((m) => m.value === val)?.label ?? val
}

export default defineComponent({
  name: 'PaymentsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Оплати' })

    const { isPrivileged } = useAuth()

    const filterDirection = ref('')
    const filterStatus = ref('')
    const filterObjectId = ref('')
    const filterClientId = ref('')
    const filterDateFrom = ref('')
    const filterDateTo = ref('')

    const { data: objectsData } = useFetch('/api/objects')
    const { data: clientsData } = useFetch('/api/clients')
    const { data: contractorsData } = useFetch('/api/contractors')

    const objects = computed(() => (objectsData.value as any)?.objects ?? [])
    const clients = computed(() => (clientsData.value as any)?.clients ?? [])
    const contractors = computed(() => (contractorsData.value as any)?.contractors ?? [])

    const { data: paymentsData, refresh, pending } = useFetch('/api/payments', {
      query: computed(() => ({
        ...(filterDirection.value && { direction: filterDirection.value }),
        ...(filterStatus.value && { status: filterStatus.value }),
        ...(filterObjectId.value && { objectId: filterObjectId.value }),
        ...(filterClientId.value && { clientId: filterClientId.value }),
        ...(filterDateFrom.value && { dateFrom: filterDateFrom.value }),
        ...(filterDateTo.value && { dateTo: filterDateTo.value }),
      })),
    })

    const { data: summaryData, refresh: refreshSummary } = useFetch('/api/payments/summary')

    const payments = computed(() => (paymentsData.value as any)?.payments ?? [])
    const summary = computed(() => summaryData.value as any ?? {})

    const dialog = ref(false)
    const editMode = ref(false)
    const editId = ref('')
    const saving = ref(false)
    const error = ref('')

    const deleteDialog = ref(false)
    const deleteTarget = ref<any>(null)
    const deleting = ref(false)

    const form = reactive({
      direction: 'INCOMING' as string,
      status: 'COMPLETED' as string,
      method: 'BANK_TRANSFER' as string,
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      description: '',
      objectId: '',
      clientId: '',
      contractorId: '',
      invoiceId: '',
    })

    function openCreate() {
      editMode.value = false
      editId.value = ''
      Object.assign(form, {
        direction: 'INCOMING',
        status: 'COMPLETED',
        method: 'BANK_TRANSFER',
        amount: '',
        date: new Date().toISOString().slice(0, 10),
        description: '',
        objectId: '',
        clientId: '',
        contractorId: '',
        invoiceId: '',
      })
      error.value = ''
      dialog.value = true
    }

    function openEdit(payment: any) {
      editMode.value = true
      editId.value = payment.id
      Object.assign(form, {
        direction: payment.direction,
        status: payment.status,
        method: payment.method,
        amount: String(Number(payment.amount)),
        date: new Date(payment.date).toISOString().slice(0, 10),
        description: payment.description || '',
        objectId: payment.objectId || '',
        clientId: payment.clientId || '',
        contractorId: payment.contractorId || '',
        invoiceId: payment.invoiceId || '',
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
          objectId: form.objectId || null,
          clientId: form.clientId || null,
          contractorId: form.contractorId || null,
          invoiceId: form.invoiceId || null,
        }
        if (editMode.value) {
          await $fetch(`/api/payments/${editId.value}`, { method: 'PUT', body: payload })
        } else {
          await $fetch('/api/payments', { method: 'POST', body: payload })
        }
        dialog.value = false
        await Promise.all([refresh(), refreshSummary()])
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        saving.value = false
      }
    }

    function openDelete(payment: any) {
      deleteTarget.value = payment
      deleteDialog.value = true
    }

    async function confirmDelete() {
      if (!deleteTarget.value) return
      deleting.value = true
      try {
        await $fetch(`/api/payments/${deleteTarget.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        deleteTarget.value = null
        await Promise.all([refresh(), refreshSummary()])
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

    const hasFilters = computed(() =>
      filterDirection.value || filterStatus.value || filterObjectId.value || filterClientId.value || filterDateFrom.value || filterDateTo.value,
    )

    const headers = [
      { title: 'Дата', key: 'date', width: 110 },
      { title: 'Тип', key: 'direction', width: 110 },
      { title: 'Сума', key: 'amount', width: 140 },
      { title: 'Статус', key: 'status', width: 130 },
      { title: 'Метод', key: 'method', width: 130 },
      { title: 'Клієнт/Контрагент', key: 'counterparty', minWidth: 160 },
      { title: 'Обʼєкт', key: 'object', minWidth: 150 },
      { title: 'Опис', key: 'description', minWidth: 150 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 100 },
    ]

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Оплати</div>
          <v-spacer />
          <v-btn variant="outlined" size="small" prepend-icon="mdi-calendar-clock" to="/payments/schedule">
            Графік платежів
          </v-btn>
          {isPrivileged.value && (
            <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
              Нова оплата
            </v-btn>
          )}
        </div>

        {/* Summary cards */}
        <v-row class="mb-4">
          <v-col cols={12} sm={6} md={3}>
            <v-card class="pa-4">
              <div class="text-caption text-medium-emphasis">Надходження</div>
              <div class="text-h6 font-weight-bold text-success">
                {formatCurrency(summary.value?.totalIncoming ?? 0)}
              </div>
              <div class="text-caption text-medium-emphasis">{summary.value?.incomingCount ?? 0} операцій</div>
            </v-card>
          </v-col>
          <v-col cols={12} sm={6} md={3}>
            <v-card class="pa-4">
              <div class="text-caption text-medium-emphasis">Витрати</div>
              <div class="text-h6 font-weight-bold text-error">
                {formatCurrency(summary.value?.totalOutgoing ?? 0)}
              </div>
              <div class="text-caption text-medium-emphasis">{summary.value?.outgoingCount ?? 0} операцій</div>
            </v-card>
          </v-col>
          <v-col cols={12} sm={6} md={3}>
            <v-card class="pa-4">
              <div class="text-caption text-medium-emphasis">Баланс</div>
              <div class={`text-h6 font-weight-bold ${(summary.value?.balance ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>
                {formatCurrency(summary.value?.balance ?? 0)}
              </div>
            </v-card>
          </v-col>
          <v-col cols={12} sm={6} md={3}>
            <v-card class="pa-4">
              <div class="text-caption text-medium-emphasis">Прострочені платежі</div>
              <div class={`text-h6 font-weight-bold ${(summary.value?.overdueSchedules ?? 0) > 0 ? 'text-error' : 'text-success'}`}>
                {summary.value?.overdueSchedules ?? 0}
              </div>
            </v-card>
          </v-col>
        </v-row>

        {/* Filters */}
        <v-card class="mb-4 pa-4">
          <v-row dense>
            <v-col cols={12} sm={6} md={2}>
              <v-select
                v-model={filterDirection.value}
                label="Тип"
                items={[{ value: '', title: 'Всі' }, ...DIRECTIONS.map((d) => ({ value: d.value, title: d.label }))]}
                density="compact"
                clearable
                hide-details
              />
            </v-col>
            <v-col cols={12} sm={6} md={2}>
              <v-select
                v-model={filterStatus.value}
                label="Статус"
                items={[{ value: '', title: 'Всі' }, ...STATUSES.map((s) => ({ value: s.value, title: s.label }))]}
                density="compact"
                clearable
                hide-details
              />
            </v-col>
            <v-col cols={12} sm={6} md={2}>
              <v-select
                v-model={filterObjectId.value}
                label="Обʼєкт"
                items={[{ value: '', title: 'Всі' }, ...objects.value.map((o: any) => ({ value: o.id, title: o.name }))]}
                density="compact"
                clearable
                hide-details
              />
            </v-col>
            <v-col cols={12} sm={6} md={2}>
              <v-select
                v-model={filterClientId.value}
                label="Клієнт"
                items={[{ value: '', title: 'Всі' }, ...clients.value.map((c: any) => ({ value: c.id, title: c.name }))]}
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
            {hasFilters.value && (
              <v-col cols={12} class="d-flex align-center">
                <v-btn
                  variant="text"
                  size="small"
                  color="error"
                  prepend-icon="mdi-filter-remove"
                  onClick={() => {
                    filterDirection.value = ''
                    filterStatus.value = ''
                    filterObjectId.value = ''
                    filterClientId.value = ''
                    filterDateFrom.value = ''
                    filterDateTo.value = ''
                  }}
                >
                  Скинути
                </v-btn>
              </v-col>
            )}
          </v-row>
        </v-card>

        {/* Payments table */}
        <v-card>
          <v-data-table headers={headers} items={payments.value} loading={pending.value} hover items-per-page={25}>
            {{
              'item.date': ({ item }: any) => formatDate(item.date),
              'item.direction': ({ item }: any) => {
                const d = directionMeta(item.direction)
                return (
                  <v-chip size="small" color={d.color} variant="tonal" prepend-icon={d.icon}>
                    {d.label}
                  </v-chip>
                )
              },
              'item.amount': ({ item }: any) => (
                <span class={`font-weight-bold ${item.direction === 'INCOMING' ? 'text-success' : 'text-error'}`}>
                  {item.direction === 'INCOMING' ? '+' : '−'}{formatCurrency(item.amount)}
                </span>
              ),
              'item.status': ({ item }: any) => {
                const s = statusMeta(item.status)
                return (
                  <v-chip size="small" color={s.color} variant="tonal" prepend-icon={s.icon}>
                    {s.label}
                  </v-chip>
                )
              },
              'item.method': ({ item }: any) => methodLabel(item.method),
              'item.counterparty': ({ item }: any) => (
                <span>
                  {item.client?.name || item.contractor?.name || '—'}
                </span>
              ),
              'item.object': ({ item }: any) => item.object?.name || '—',
              'item.description': ({ item }: any) => (
                <span class="text-truncate d-inline-block" style={{ maxWidth: '200px' }}>
                  {item.description || '—'}
                </span>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end">
                  <v-btn icon="mdi-pencil" variant="text" size="small" onClick={() => openEdit(item)} />
                  <v-btn icon="mdi-delete" variant="text" size="small" color="error" onClick={() => openDelete(item)} />
                </div>
              ),
            }}
          </v-data-table>
        </v-card>

        {/* Create/Edit dialog */}
        <v-dialog v-model={dialog.value} max-width={600}>
          <v-card>
            <v-card-title class="pa-4">
              {editMode.value ? 'Редагувати оплату' : 'Нова оплата'}
            </v-card-title>
            <v-card-text class="pa-5 pt-2">
              {error.value && <v-alert type="error" variant="tonal" class="mb-4">{error.value}</v-alert>}

              <v-row dense>
                <v-col cols={12} sm={6}>
                  <v-select
                    v-model={form.direction}
                    label="Тип *"
                    items={DIRECTIONS.map((d) => ({ value: d.value, title: d.label }))}
                  />
                </v-col>
                <v-col cols={12} sm={6}>
                  <v-text-field
                    v-model={form.amount}
                    label="Сума (грн) *"
                    type="number"
                    min="0.01"
                    step="0.01"
                  />
                </v-col>
                <v-col cols={12} sm={6}>
                  <v-text-field
                    v-model={form.date}
                    label="Дата *"
                    type="date"
                  />
                </v-col>
                <v-col cols={12} sm={6}>
                  <v-select
                    v-model={form.method}
                    label="Метод оплати"
                    items={METHODS.map((m) => ({ value: m.value, title: m.label }))}
                  />
                </v-col>
                <v-col cols={12} sm={6}>
                  <v-select
                    v-model={form.status}
                    label="Статус"
                    items={STATUSES.map((s) => ({ value: s.value, title: s.label }))}
                  />
                </v-col>
                <v-col cols={12} sm={6}>
                  <v-select
                    v-model={form.objectId}
                    label="Обʼєкт"
                    items={[{ value: '', title: 'Без обʼєкту' }, ...objects.value.map((o: any) => ({ value: o.id, title: o.name }))]}
                    clearable
                  />
                </v-col>
                <v-col cols={12} sm={6}>
                  <v-select
                    v-model={form.clientId}
                    label="Клієнт"
                    items={[{ value: '', title: '—' }, ...clients.value.map((c: any) => ({ value: c.id, title: c.name }))]}
                    clearable
                  />
                </v-col>
                <v-col cols={12} sm={6}>
                  <v-select
                    v-model={form.contractorId}
                    label="Контрагент"
                    items={[{ value: '', title: '—' }, ...contractors.value.map((c: any) => ({ value: c.id, title: c.name }))]}
                    clearable
                  />
                </v-col>
                <v-col cols={12}>
                  <v-textarea
                    v-model={form.description}
                    label="Опис"
                    rows={2}
                    auto-grow
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
                disabled={!form.amount || !form.date}
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
            <v-card-title>Видалити оплату?</v-card-title>
            <v-card-text>
              Оплату на суму <strong>{deleteTarget.value ? formatCurrency(deleteTarget.value.amount) : ''}</strong> буде видалено назавжди.
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
