export default defineComponent({
  name: 'AuditLogPage',
  setup() {
    definePageMeta({ middleware: ['auth', 'admin'] })
    useHead({ title: 'Журнал змін' })

    const page = ref(1)
    const limit = 25
    const filterEntity = ref('')

    const { data, pending } = useFetch('/api/audit-logs', {
      query: computed(() => ({
        page: page.value,
        limit,
        ...(filterEntity.value ? { entityType: filterEntity.value } : {}),
      })),
      watch: [page, filterEntity],
    })

    const items = computed(() => (data.value as any)?.items ?? [])
    const total = computed(() => (data.value as any)?.total ?? 0)
    const pageCount = computed(() => Math.ceil(total.value / limit))

    watch(filterEntity, () => { page.value = 1 })

    const entityTypes = [
      { value: '', title: 'Всі' },
      { value: 'Warehouse', title: 'Склади' },
      { value: 'ConstructionObject', title: 'Обʼєкти' },
      { value: 'Product', title: 'Товари' },
      { value: 'Contractor', title: 'Контрагенти' },
      { value: 'Invoice', title: 'Накладні' },
      { value: 'Movement', title: 'Переміщення' },
      { value: 'Task', title: 'Завдання' },
      { value: 'Project', title: 'Проєкти' },
      { value: 'User', title: 'Користувачі' },
    ]

    const ENTITY_TYPE_LABELS: Record<string, string> = {
      Warehouse: 'Склад',
      ConstructionObject: 'Обʼєкт',
      Product: 'Товар',
      ProductGroup: 'Група товарів',
      Contractor: 'Контрагент',
      Invoice: 'Накладна',
      Movement: 'Переміщення',
      Task: 'Завдання',
      Project: 'Проєкт',
      TimeLog: 'Запис часу',
      User: 'Користувач',
    }

    const FIELD_LABELS: Record<string, string> = {
      name: 'Назва',
      title: 'Назва',
      description: 'Опис',
      address: 'Адреса',
      status: 'Статус',
      priority: 'Пріоритет',
      budget: 'Бюджет',
      isActive: 'Активний',
      sku: 'Артикул',
      unit: 'Одиниця',
      groupId: 'Група',
      contactPerson: 'Контактна особа',
      phone: 'Телефон',
      email: 'Email',
      notes: 'Примітки',
      taxCode: 'ЄДРПОУ/ІПН',
      iban: 'IBAN',
      bankName: 'Банк',
      bankMfo: 'МФО',
      paymentNotes: 'Примітки до оплати',
      color: 'Колір',
      role: 'Роль',
      hourlyRate: 'Ставка (грн/год)',
      jobTitleId: 'Посада',
      assignedToId: 'Виконавець',
      objectId: 'Об\'єкт',
      dueDate: 'Дедлайн',
      estimatedHours: 'Очікувано годин',
      number: 'Номер',
      type: 'Тип',
      warehouseId: 'Склад',
      contractorId: 'Контрагент',
      itemCount: 'Кількість позицій',
      fromWarehouseId: 'Зі складу',
      toWarehouseId: 'На склад',
      defaultObjectId: 'Об\'єкт за замовчуванням',
      id: 'ID',
    }

    const STATUS_LABELS: Record<string, string> = {
      TODO: 'До виконання',
      IN_PROGRESS: 'В роботі',
      REVIEW: 'На перевірці',
      DONE: 'Виконано',
      CANCELLED: 'Скасовано',
      ACTIVE: 'Активний',
      COMPLETED: 'Завершено',
      SUSPENDED: 'Призупинено',
    }

    const PRIORITY_LABELS: Record<string, string> = {
      LOW: 'Низький',
      MEDIUM: 'Середній',
      HIGH: 'Високий',
      URGENT: 'Терміново',
    }

    function formatValue(key: string, val: unknown): string {
      if (val === null || val === undefined) return '—'
      if (typeof val === 'boolean') return val ? 'Так' : 'Ні'
      if (key === 'status' && typeof val === 'string' && STATUS_LABELS[val]) return STATUS_LABELS[val]
      if (key === 'priority' && typeof val === 'string' && PRIORITY_LABELS[val]) return PRIORITY_LABELS[val]
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
        return new Date(val).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })
      }
      if (typeof val === 'object') return JSON.stringify(val)
      return String(val)
    }

    const ACTION_META: Record<string, { label: string; color: string; icon: string }> = {
      CREATE: { label: 'Створення', color: 'success', icon: 'mdi-plus-circle-outline' },
      UPDATE: { label: 'Оновлення', color: 'info', icon: 'mdi-pencil-outline' },
      DELETE: { label: 'Видалення', color: 'error', icon: 'mdi-delete-outline' },
    }

    const expandedRows = ref<string[]>([])
    function toggleExpand(id: string) {
      const idx = expandedRows.value.indexOf(id)
      if (idx === -1) expandedRows.value.push(id)
      else expandedRows.value.splice(idx, 1)
    }

    const headers = [
      { title: '', key: 'expand', sortable: false, width: 48 },
      { title: 'Дата', key: 'createdAt', width: 160 },
      { title: 'Дія', key: 'action', width: 130 },
      { title: 'Тип', key: 'entityType', width: 140 },
      { title: 'Користувач', key: 'userName' },
    ]

    function renderChangesDetail(changes: any, action: string) {
      if (!changes || typeof changes !== 'object') return null
      const entries = Object.entries(changes).filter(([, v]) => v != null)
      if (!entries.length) return null

      if (action === 'CREATE' || action === 'DELETE') {
        return (
          <div class="d-flex flex-wrap ga-1 pa-3">
            {entries.map(([k, v]) => (
              <v-chip key={k} size="x-small" variant="outlined" label>
                {FIELD_LABELS[k] ?? k}: {formatValue(k, v)}
              </v-chip>
            ))}
          </div>
        )
      }

      return (
        <v-table density="compact">
          <thead>
            <tr>
              <th style="width: 30%">Поле</th>
              <th style="width: 35%">Було</th>
              <th style="width: 35%">Стало</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, change]: [string, any]) => (
              <tr key={key}>
                <td class="font-weight-medium">{FIELD_LABELS[key] ?? key}</td>
                <td class="text-medium-emphasis">{formatValue(key, change?.old)}</td>
                <td class="font-weight-medium">{formatValue(key, change?.new)}</td>
              </tr>
            ))}
          </tbody>
        </v-table>
      )
    }

    return () => (
      <div>
        <div class="d-flex align-center mb-4 ga-4 flex-wrap">
          <div class="text-h5 font-weight-bold">Журнал змін</div>
          <v-spacer />
          <v-select
            v-model={filterEntity.value}
            items={entityTypes}
            label="Тип сутності"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 220px"
            clearable
          />
        </div>

        <v-card>
          <v-data-table
            headers={headers}
            items={items.value}
            loading={pending.value}
            hover
            hide-default-footer
            item-value="id"
            expanded={expandedRows.value}
            onUpdate:expanded={(val: string[]) => { expandedRows.value = val }}
          >
            {{
              'item.expand': ({ item }: any) => (
                item.changes ? (
                  <v-btn
                    icon={expandedRows.value.includes(item.id) ? 'mdi-chevron-up' : 'mdi-chevron-down'}
                    variant="text"
                    size="small"
                    onClick={() => toggleExpand(item.id)}
                  />
                ) : null
              ),
              'item.createdAt': ({ item }: any) => (
                <span class="text-body-2">
                  {new Date(item.createdAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              ),
              'item.action': ({ item }: any) => {
                const meta = ACTION_META[item.action] ?? ACTION_META.UPDATE
                return (
                  <v-chip size="small" color={meta.color} variant="tonal" prepend-icon={meta.icon} label>
                    {meta.label}
                  </v-chip>
                )
              },
              'item.entityType': ({ item }: any) => (
                <v-chip size="small" variant="outlined" label>
                  {ENTITY_TYPE_LABELS[item.entityType] ?? item.entityType}
                </v-chip>
              ),
              'item.userName': ({ item }: any) => (
                <span>{item.userName ?? '—'}</span>
              ),
              'expanded-row': ({ item }: any) => (
                <tr>
                  <td colspan={5} class="pa-0">
                    {renderChangesDetail(item.changes, item.action)}
                  </td>
                </tr>
              ),
            }}
          </v-data-table>

          {pageCount.value > 1 && (
            <div class="d-flex justify-center pa-4">
              <v-pagination
                v-model={page.value}
                length={pageCount.value}
                total-visible={7}
                density="compact"
                rounded="circle"
              />
            </div>
          )}
        </v-card>
      </div>
    )
  },
})
