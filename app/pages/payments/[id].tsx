const DIRECTIONS: Record<string, { label: string; color: string; icon: string }> = {
  INCOMING: { label: 'Вхідна', color: 'success', icon: 'mdi-arrow-down-bold' },
  OUTGOING: { label: 'Вихідна', color: 'error', icon: 'mdi-arrow-up-bold' },
}

const STATUSES: Record<string, { label: string; color: string; icon: string }> = {
  PENDING: { label: 'Очікується', color: 'warning', icon: 'mdi-clock-outline' },
  COMPLETED: { label: 'Проведена', color: 'success', icon: 'mdi-check-circle-outline' },
  CANCELLED: { label: 'Скасована', color: 'grey', icon: 'mdi-close-circle-outline' },
}

const METHODS: Record<string, string> = {
  BANK_TRANSFER: 'Безготівковий',
  CASH: 'Готівка',
  CARD: 'Картка',
  OTHER: 'Інше',
}

export default defineComponent({
  name: 'PaymentDetailPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const id = route.params.id as string
    const { data, pending, refresh } = useFetch(`/api/payments/${id}`)
    const payment = computed(() => data.value as any)

    useHead({
      title: computed(() => payment.value ? `Оплата: ${formatCurrency(payment.value.amount)}` : 'Оплата'),
    })

    const { isPrivileged } = useAuth()

    const editDialog = ref(false)
    const saving = ref(false)
    const error = ref('')

    const { data: objectsData } = useFetch('/api/objects')
    const { data: clientsData } = useFetch('/api/clients')
    const { data: contractorsData } = useFetch('/api/contractors')
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])
    const clients = computed(() => (clientsData.value as any)?.clients ?? [])
    const contractors = computed(() => (contractorsData.value as any)?.contractors ?? [])

    const form = reactive({
      direction: '',
      status: '',
      method: '',
      amount: '',
      date: '',
      description: '',
      objectId: '',
      clientId: '',
      contractorId: '',
    })

    function openEdit() {
      if (!payment.value) return
      Object.assign(form, {
        direction: payment.value.direction,
        status: payment.value.status,
        method: payment.value.method,
        amount: String(Number(payment.value.amount)),
        date: new Date(payment.value.date).toISOString().slice(0, 10),
        description: payment.value.description || '',
        objectId: payment.value.objectId || '',
        clientId: payment.value.clientId || '',
        contractorId: payment.value.contractorId || '',
      })
      error.value = ''
      editDialog.value = true
    }

    async function save() {
      saving.value = true
      error.value = ''
      try {
        await $fetch(`/api/payments/${id}`, {
          method: 'PUT',
          body: {
            ...form,
            amount: Number(form.amount),
            objectId: form.objectId || null,
            clientId: form.clientId || null,
            contractorId: form.contractorId || null,
          },
        })
        editDialog.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        saving.value = false
      }
    }

    const deleteDialog = ref(false)
    const deleting = ref(false)

    async function confirmDelete() {
      deleting.value = true
      try {
        await $fetch(`/api/payments/${id}`, { method: 'DELETE' })
        navigateTo('/payments')
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

    return () => {
      if (pending.value) {
        return <v-progress-linear indeterminate color="primary" />
      }
      if (!payment.value) {
        return (
          <v-alert type="error" variant="tonal">Оплату не знайдено</v-alert>
        )
      }

      const p = payment.value
      const dir = DIRECTIONS[p.direction] ?? DIRECTIONS.INCOMING
      const st = STATUSES[p.status] ?? STATUSES.PENDING

      return (
        <div>
          <div class="page-toolbar">
            <v-btn variant="text" icon="mdi-arrow-left" to="/payments" />
            <div class="text-h5 font-weight-bold">
              {dir.label} оплата
            </div>
            <v-spacer />
            {isPrivileged.value && (
              <>
                <v-btn variant="outlined" prepend-icon="mdi-pencil" onClick={openEdit}>
                  Редагувати
                </v-btn>
                <v-btn variant="outlined" color="error" prepend-icon="mdi-delete" onClick={() => (deleteDialog.value = true)}>
                  Видалити
                </v-btn>
              </>
            )}
          </div>

          <v-row>
            <v-col cols={12} md={8}>
              <v-card class="mb-4">
                <v-card-text class="pa-5">
                  <v-row dense>
                    <v-col cols={12} sm={6}>
                      <div class="text-caption text-medium-emphasis">Сума</div>
                      <div class={`text-h4 font-weight-bold ${p.direction === 'INCOMING' ? 'text-success' : 'text-error'}`}>
                        {p.direction === 'INCOMING' ? '+' : '−'}{formatCurrency(p.amount)}
                      </div>
                    </v-col>
                    <v-col cols={12} sm={6}>
                      <div class="text-caption text-medium-emphasis">Дата</div>
                      <div class="text-h6">{formatDate(p.date)}</div>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>

              <v-card>
                <v-card-text class="pa-5">
                  <v-table density="comfortable">
                    <tbody>
                      <tr>
                        <td class="text-medium-emphasis" style={{ width: '180px' }}>Напрямок</td>
                        <td>
                          <v-chip size="small" color={dir.color} variant="tonal" prepend-icon={dir.icon}>
                            {dir.label}
                          </v-chip>
                        </td>
                      </tr>
                      <tr>
                        <td class="text-medium-emphasis">Статус</td>
                        <td>
                          <v-chip size="small" color={st.color} variant="tonal" prepend-icon={st.icon}>
                            {st.label}
                          </v-chip>
                        </td>
                      </tr>
                      <tr>
                        <td class="text-medium-emphasis">Метод оплати</td>
                        <td>{METHODS[p.method] ?? p.method}</td>
                      </tr>
                      <tr>
                        <td class="text-medium-emphasis">Обʼєкт</td>
                        <td>{p.object ? <nuxt-link to={`/reports/objects/${p.object.id}`}>{p.object.name}</nuxt-link> : '—'}</td>
                      </tr>
                      <tr>
                        <td class="text-medium-emphasis">Клієнт</td>
                        <td>{p.client?.name || '—'}</td>
                      </tr>
                      <tr>
                        <td class="text-medium-emphasis">Контрагент</td>
                        <td>{p.contractor?.name || '—'}</td>
                      </tr>
                      <tr>
                        <td class="text-medium-emphasis">Накладна</td>
                        <td>{p.invoice ? `#${p.invoice.number}` : '—'}</td>
                      </tr>
                      <tr>
                        <td class="text-medium-emphasis">Опис</td>
                        <td>{p.description || '—'}</td>
                      </tr>
                      <tr>
                        <td class="text-medium-emphasis">Створив</td>
                        <td>{p.createdBy?.name ?? '—'}</td>
                      </tr>
                      <tr>
                        <td class="text-medium-emphasis">Створено</td>
                        <td>{formatDate(p.createdAt)}</td>
                      </tr>
                    </tbody>
                  </v-table>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          {/* Edit dialog */}
          <v-dialog v-model={editDialog.value} max-width={600}>
            <v-card>
              <v-card-title class="pa-4">Редагувати оплату</v-card-title>
              <v-card-text class="pa-5 pt-2">
                {error.value && <v-alert type="error" variant="tonal" class="mb-4">{error.value}</v-alert>}
                <v-row dense>
                  <v-col cols={12} sm={6}>
                    <v-select
                      v-model={form.direction}
                      label="Тип"
                      items={Object.entries(DIRECTIONS).map(([v, d]) => ({ value: v, title: d.label }))}
                    />
                  </v-col>
                  <v-col cols={12} sm={6}>
                    <v-text-field v-model={form.amount} label="Сума (грн)" type="number" min="0.01" step="0.01" />
                  </v-col>
                  <v-col cols={12} sm={6}>
                    <v-text-field v-model={form.date} label="Дата" type="date" />
                  </v-col>
                  <v-col cols={12} sm={6}>
                    <v-select
                      v-model={form.method}
                      label="Метод"
                      items={Object.entries(METHODS).map(([v, l]) => ({ value: v, title: l }))}
                    />
                  </v-col>
                  <v-col cols={12} sm={6}>
                    <v-select
                      v-model={form.status}
                      label="Статус"
                      items={Object.entries(STATUSES).map(([v, s]) => ({ value: v, title: s.label }))}
                    />
                  </v-col>
                  <v-col cols={12} sm={6}>
                    <v-select
                      v-model={form.objectId}
                      label="Обʼєкт"
                      items={[{ value: '', title: '—' }, ...objects.value.map((o: any) => ({ value: o.id, title: o.name }))]}
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
                    <v-textarea v-model={form.description} label="Опис" rows={2} auto-grow />
                  </v-col>
                </v-row>
              </v-card-text>
              <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="outlined" onClick={() => (editDialog.value = false)}>Скасувати</v-btn>
                <v-btn color="primary" variant="elevated" loading={saving.value} onClick={save}>Зберегти</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          {/* Delete dialog */}
          <v-dialog v-model={deleteDialog.value} max-width={420}>
            <v-card>
              <v-card-title>Видалити оплату?</v-card-title>
              <v-card-text>Оплату на суму <strong>{formatCurrency(p.amount)}</strong> буде видалено назавжди.</v-card-text>
              <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="outlined" onClick={() => (deleteDialog.value = false)}>Скасувати</v-btn>
                <v-btn color="error" variant="elevated" loading={deleting.value} onClick={confirmDelete}>Видалити</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </div>
      )
    }
  },
})
