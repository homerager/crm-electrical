export default defineComponent({
  name: 'AuditLogPanel',
  props: {
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
  },
  setup(props) {
    const page = ref(1)
    const limit = 15

    const { data, pending, refresh } = useFetch('/api/audit-logs', {
      query: computed(() => ({
        entityType: props.entityType,
        entityId: props.entityId,
        page: page.value,
        limit,
      })),
      watch: [() => props.entityId, page],
    })

    const items = computed(() => (data.value as any)?.items ?? [])
    const total = computed(() => (data.value as any)?.total ?? 0)
    const pageCount = computed(() => Math.ceil(total.value / limit))

    watch(() => props.entityId, () => { page.value = 1 })

    const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
      CREATE: { label: 'Створення', color: 'success', icon: 'mdi-plus-circle-outline' },
      UPDATE: { label: 'Оновлення', color: 'info', icon: 'mdi-pencil-outline' },
      DELETE: { label: 'Видалення', color: 'error', icon: 'mdi-delete-outline' },
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
      if ((key === 'status') && typeof val === 'string' && STATUS_LABELS[val]) return STATUS_LABELS[val]
      if ((key === 'priority') && typeof val === 'string' && PRIORITY_LABELS[val]) return PRIORITY_LABELS[val]
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
        return new Date(val).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })
      }
      if (typeof val === 'object') return JSON.stringify(val)
      return String(val)
    }

    function renderChanges(log: any) {
      const changes = log.changes
      if (!changes || typeof changes !== 'object') return null

      if (log.action === 'CREATE' || log.action === 'DELETE') {
        const entries = Object.entries(changes).filter(([, v]) => v != null)
        if (!entries.length) return null
        return (
          <div class="d-flex flex-wrap ga-1 mt-1">
            {entries.map(([key, val]) => (
              <v-chip key={key} size="x-small" variant="outlined" label>
                {FIELD_LABELS[key] ?? key}: {formatValue(key, val)}
              </v-chip>
            ))}
          </div>
        )
      }

      const entries = Object.entries(changes)
      if (!entries.length) return null
      return (
        <v-table density="compact" class="mt-2 audit-changes-table">
          <thead>
            <tr>
              <th class="text-left" style="width: 30%">Поле</th>
              <th class="text-left" style="width: 35%">Було</th>
              <th class="text-left" style="width: 35%">Стало</th>
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
        {pending.value && !items.value.length ? (
          <div class="d-flex justify-center pa-6">
            <v-progress-circular indeterminate color="primary" />
          </div>
        ) : items.value.length === 0 ? (
          <v-alert variant="tonal" color="grey" icon="mdi-history" class="ma-4">
            Немає записів в історії змін
          </v-alert>
        ) : (
          <>
            <v-timeline density="compact" side="end" class="pa-4">
              {items.value.map((log: any) => {
                const meta = ACTION_LABELS[log.action] ?? ACTION_LABELS.UPDATE
                return (
                  <v-timeline-item
                    key={log.id}
                    dot-color={meta.color}
                    icon={meta.icon}
                    size="small"
                  >
                    <div>
                      <div class="d-flex align-center flex-wrap ga-2">
                        <v-chip size="small" color={meta.color} variant="tonal" label>
                          {meta.label}
                        </v-chip>
                        <span class="text-body-2 font-weight-medium">
                          {log.userName ?? 'Система'}
                        </span>
                        <span class="text-caption text-medium-emphasis">
                          {new Date(log.createdAt).toLocaleString('uk-UA', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      {renderChanges(log)}
                    </div>
                  </v-timeline-item>
                )
              })}
            </v-timeline>

            {pageCount.value > 1 && (
              <div class="d-flex justify-center pb-4">
                <v-pagination
                  v-model={page.value}
                  length={pageCount.value}
                  total-visible={5}
                  density="compact"
                  rounded="circle"
                />
              </div>
            )}
          </>
        )}
      </div>
    )
  },
})
