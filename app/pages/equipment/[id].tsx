const STATUS_COLORS: Record<string, string> = {
  IN_STOCK: 'success',
  INSTALLED: 'primary',
  IN_REPAIR: 'warning',
  DECOMMISSIONED: 'grey',
  IN_TRANSIT: 'info',
}

const STATUS_LABELS: Record<string, string> = {
  IN_STOCK: 'На складі',
  INSTALLED: 'Встановлено',
  IN_REPAIR: 'На ремонті',
  DECOMMISSIONED: 'Списано',
  IN_TRANSIT: 'В дорозі',
}

const STATUS_OPTIONS = [
  { value: 'IN_STOCK', title: 'На складі' },
  { value: 'INSTALLED', title: 'Встановлено' },
  { value: 'IN_REPAIR', title: 'На ремонті' },
  { value: 'DECOMMISSIONED', title: 'Списано' },
  { value: 'IN_TRANSIT', title: 'В дорозі' },
]

export default defineComponent({
  name: 'EquipmentCardPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const id = computed(() => route.params.id as string)

    const { isPrivileged } = useAuth()
    const toast = useToast()

    const { data, refresh, pending } = useFetch(computed(() => `/api/equipment/${id.value}`))
    const eq = computed(() => (data.value as any)?.equipment)

    useHead({ title: computed(() => eq.value?.name ?? 'Обладнання') })

    // Movement dialog
    const moveDialog = ref(false)
    const moveSaving = ref(false)
    const moveError = ref('')
    const moveForm = reactive({ toWarehouseId: '', toObjectId: '', reason: '' })

    const { data: warehousesData } = useFetch('/api/warehouses')
    const { data: objectsData } = useFetch('/api/objects')
    const warehouses = computed(() => (warehousesData.value as any)?.warehouses ?? [])
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])

    function openMove() {
      Object.assign(moveForm, { toWarehouseId: '', toObjectId: '', reason: '' })
      moveError.value = ''
      moveDialog.value = true
    }

    async function submitMove() {
      moveSaving.value = true
      moveError.value = ''
      try {
        await $fetch(`/api/equipment/${id.value}/movements`, { method: 'POST', body: moveForm })
        moveDialog.value = false
        await refresh()
        toast.success('Обладнання переміщено')
      } catch (e: any) {
        moveError.value = e?.data?.statusMessage || 'Помилка переміщення'
        toast.error(moveError.value)
      } finally {
        moveSaving.value = false
      }
    }

    // Status change dialog
    const statusDialog = ref(false)
    const statusSaving = ref(false)
    const statusError = ref('')
    const statusForm = reactive({ newStatus: '', reason: '' })

    function openStatusChange() {
      statusForm.newStatus = eq.value?.status || ''
      statusForm.reason = ''
      statusError.value = ''
      statusDialog.value = true
    }

    async function submitStatusChange() {
      statusSaving.value = true
      statusError.value = ''
      try {
        await $fetch(`/api/equipment/${id.value}/status`, { method: 'POST', body: statusForm })
        statusDialog.value = false
        await refresh()
        toast.success('Статус обладнання змінено')
      } catch (e: any) {
        statusError.value = e?.data?.statusMessage || 'Помилка зміни статусу'
        toast.error(statusError.value)
      } finally {
        statusSaving.value = false
      }
    }

    // Tab state
    const tab = ref('info')

    function formatDate(d: string | null) {
      if (!d) return '—'
      return new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    function locationName(movement: any, prefix: 'from' | 'to') {
      const wh = movement[`${prefix}Warehouse`]
      const obj = movement[`${prefix}Object`]
      if (wh) return `Склад: ${wh.name}`
      if (obj) return `Обʼєкт: ${obj.name}`
      return '—'
    }

    return () => {
      if (pending.value && !eq.value) {
        return (
          <div class="d-flex justify-center pa-12">
            <v-progress-circular indeterminate color="primary" size="48" />
          </div>
        )
      }

      if (!eq.value) {
        return (
          <v-alert type="error" variant="tonal" class="ma-4">
            Обладнання не знайдено
          </v-alert>
        )
      }

      const item = eq.value

      return (
        <div>
          <div class="page-toolbar">
            <v-btn icon="mdi-arrow-left" variant="text" to="/equipment" />
            <div class="text-h5 font-weight-bold ml-2">{item.name}</div>
            <v-chip class="ml-3" color={STATUS_COLORS[item.status]} variant="tonal" size="small">
              {STATUS_LABELS[item.status]}
            </v-chip>
            <v-spacer />
            {isPrivileged.value && (
              <>
                <v-btn variant="outlined" prepend-icon="mdi-swap-horizontal" class="mr-2" onClick={openMove}>
                  Перемістити
                </v-btn>
                <v-btn variant="outlined" prepend-icon="mdi-state-machine" onClick={openStatusChange}>
                  Змінити статус
                </v-btn>
              </>
            )}
          </div>

          <v-tabs v-model={tab.value} class="mb-4">
            <v-tab value="info">Інформація</v-tab>
            <v-tab value="movements">Переміщення</v-tab>
            <v-tab value="status-history">Історія статусів</v-tab>
            <v-tab value="qr">QR-код</v-tab>
          </v-tabs>

          <v-window v-model={tab.value}>
            {/* Info tab */}
            <v-window-item value="info">
              <v-card>
                <v-card-text>
                  <v-row>
                    <v-col cols={12} md={6}>
                      <v-list density="compact" class="bg-transparent">
                        <v-list-item>
                          <v-list-item-title class="text-caption text-medium-emphasis">Назва</v-list-item-title>
                          <v-list-item-subtitle class="text-body-1">{item.name}</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <v-list-item-title class="text-caption text-medium-emphasis">Модель</v-list-item-title>
                          <v-list-item-subtitle class="text-body-1">{item.model || '—'}</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <v-list-item-title class="text-caption text-medium-emphasis">Серійний номер</v-list-item-title>
                          <v-list-item-subtitle class="text-body-1">{item.serialNumber || '—'}</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <v-list-item-title class="text-caption text-medium-emphasis">Штрих-код</v-list-item-title>
                          <v-list-item-subtitle class="text-body-1">{item.barcode || '—'}</v-list-item-subtitle>
                        </v-list-item>
                      </v-list>
                    </v-col>
                    <v-col cols={12} md={6}>
                      <v-list density="compact" class="bg-transparent">
                        <v-list-item>
                          <v-list-item-title class="text-caption text-medium-emphasis">Місцезнаходження</v-list-item-title>
                          <v-list-item-subtitle class="text-body-1">
                            {item.currentWarehouse ? `Склад: ${item.currentWarehouse.name}` : item.currentObject ? `Обʼєкт: ${item.currentObject.name}` : '—'}
                          </v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <v-list-item-title class="text-caption text-medium-emphasis">Відповідальний</v-list-item-title>
                          <v-list-item-subtitle class="text-body-1">{item.responsibleUser?.name || '—'}</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <v-list-item-title class="text-caption text-medium-emphasis">Створено</v-list-item-title>
                          <v-list-item-subtitle class="text-body-1">{formatDate(item.createdAt)}</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                          <v-list-item-title class="text-caption text-medium-emphasis">Оновлено</v-list-item-title>
                          <v-list-item-subtitle class="text-body-1">{formatDate(item.updatedAt)}</v-list-item-subtitle>
                        </v-list-item>
                      </v-list>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-window-item>

            {/* Movements tab */}
            <v-window-item value="movements">
              <v-card>
                <v-card-text>
                  {item.movements?.length ? (
                    <v-timeline side="end" density="compact">
                      {item.movements.map((m: any) => (
                        <v-timeline-item key={m.id} dot-color="primary" size="small">
                          <div>
                            <div class="text-body-2 font-weight-medium">
                              {locationName(m, 'from')} → {locationName(m, 'to')}
                            </div>
                            {m.reason && <div class="text-body-2 text-medium-emphasis">{m.reason}</div>}
                            <div class="text-caption text-medium-emphasis">
                              {m.performedBy?.name} • {formatDate(m.createdAt)}
                            </div>
                          </div>
                        </v-timeline-item>
                      ))}
                    </v-timeline>
                  ) : (
                    <div class="text-center text-medium-emphasis pa-6">Переміщень немає</div>
                  )}
                </v-card-text>
              </v-card>
            </v-window-item>

            {/* Status history tab */}
            <v-window-item value="status-history">
              <v-card>
                <v-card-text>
                  {item.statusHistory?.length ? (
                    <v-timeline side="end" density="compact">
                      {item.statusHistory.map((s: any) => (
                        <v-timeline-item key={s.id} dot-color={STATUS_COLORS[s.newStatus] || 'grey'} size="small">
                          <div>
                            <div class="text-body-2 font-weight-medium">
                              <v-chip size="x-small" color={STATUS_COLORS[s.oldStatus]} variant="tonal" class="mr-1">
                                {STATUS_LABELS[s.oldStatus]}
                              </v-chip>
                              →
                              <v-chip size="x-small" color={STATUS_COLORS[s.newStatus]} variant="tonal" class="ml-1">
                                {STATUS_LABELS[s.newStatus]}
                              </v-chip>
                            </div>
                            {s.reason && <div class="text-body-2 text-medium-emphasis mt-1">{s.reason}</div>}
                            <div class="text-caption text-medium-emphasis">
                              {s.changedBy?.name} • {formatDate(s.createdAt)}
                            </div>
                          </div>
                        </v-timeline-item>
                      ))}
                    </v-timeline>
                  ) : (
                    <div class="text-center text-medium-emphasis pa-6">Історії статусів немає</div>
                  )}
                </v-card-text>
              </v-card>
            </v-window-item>

            {/* QR tab */}
            <v-window-item value="qr">
              <v-card>
                <v-card-text class="d-flex flex-column align-center pa-8">
                  <EquipmentQrCode equipmentId={item.id} name={item.name} size={300} />
                  <div class="text-caption text-medium-emphasis mt-4">{item.qrCodeUrl || `${window.location.origin}/equipment/${item.id}`}</div>
                </v-card-text>
              </v-card>
            </v-window-item>
          </v-window>

          {/* Movement dialog */}
          <v-dialog v-model={moveDialog.value} max-width={500}>
            <v-card>
              <v-card-title>Перемістити обладнання</v-card-title>
              <v-card-text>
                {moveError.value && <v-alert type="error" variant="tonal" class="mb-3">{moveError.value}</v-alert>}
                <div class="text-body-2 mb-3">
                  Поточне місце: <strong>{item.currentWarehouse ? `Склад: ${item.currentWarehouse.name}` : item.currentObject ? `Обʼєкт: ${item.currentObject.name}` : 'Не вказано'}</strong>
                </div>
                <v-select
                  v-model={moveForm.toWarehouseId}
                  items={warehouses.value}
                  item-value="id"
                  item-title="name"
                  label="На склад"
                  clearable
                  class="mb-3"
                  disabled={!!moveForm.toObjectId}
                />
                <v-select
                  v-model={moveForm.toObjectId}
                  items={objects.value}
                  item-value="id"
                  item-title="name"
                  label="На обʼєкт"
                  clearable
                  class="mb-3"
                  disabled={!!moveForm.toWarehouseId}
                />
                <v-textarea v-model={moveForm.reason} label="Причина" rows={2} />
              </v-card-text>
              <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="outlined" onClick={() => (moveDialog.value = false)}>Скасувати</v-btn>
                <v-btn
                  color="primary"
                  variant="elevated"
                  loading={moveSaving.value}
                  disabled={!moveForm.toWarehouseId && !moveForm.toObjectId}
                  onClick={submitMove}
                >
                  Перемістити
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          {/* Status change dialog */}
          <v-dialog v-model={statusDialog.value} max-width={450}>
            <v-card>
              <v-card-title>Змінити статус</v-card-title>
              <v-card-text>
                {statusError.value && <v-alert type="error" variant="tonal" class="mb-3">{statusError.value}</v-alert>}
                <v-select
                  v-model={statusForm.newStatus}
                  items={STATUS_OPTIONS}
                  item-value="value"
                  item-title="title"
                  label="Новий статус"
                  class="mb-3"
                />
                <v-textarea v-model={statusForm.reason} label="Причина" rows={2} />
              </v-card-text>
              <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="outlined" onClick={() => (statusDialog.value = false)}>Скасувати</v-btn>
                <v-btn
                  color="primary"
                  variant="elevated"
                  loading={statusSaving.value}
                  disabled={!statusForm.newStatus || statusForm.newStatus === item.status}
                  onClick={submitStatusChange}
                >
                  Змінити
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </div>
      )
    }
  },
})
