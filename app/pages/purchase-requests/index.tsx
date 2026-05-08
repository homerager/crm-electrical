interface RequestItemRow {
  productId: string
  quantity: number
  estimatedPricePerUnit: number
  vatPercent: number
  note?: string
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Чернетка',
  APPROVED: 'Погоджено',
  ORDERED: 'Замовлено',
  RECEIVED: 'Отримано',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'grey',
  APPROVED: 'primary',
  ORDERED: 'warning',
  RECEIVED: 'success',
}

export default defineComponent({
  name: 'PurchaseRequestsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({ title: 'Заявки на закупівлю' })

    const filterStatus = ref<string | null>(null)
    const { data, pending, refresh } = useFetch('/api/purchase-requests', {
      query: computed(() => (filterStatus.value ? { status: filterStatus.value } : {})),
    })
    const { data: objectsData } = useFetch('/api/objects')
    const { data: productsData } = useFetch('/api/products')
    const { data: warehousesData } = useFetch('/api/warehouses')
    const { data: contractorsData } = useFetch('/api/contractors')
    const { data: settingsData } = useFetch('/api/settings')

    const purchaseRequests = computed(() => (data.value as any)?.purchaseRequests ?? [])
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])
    const products = computed(() => (productsData.value as any)?.products ?? [])
    const warehouses = computed(() => (warehousesData.value as any)?.warehouses ?? [])
    const contractors = computed(() => (contractorsData.value as any)?.contractors ?? [])
    const defaultVatPercent = computed(() => {
      const s = (settingsData.value as any)?.settings
      return s?.defaultVatPercent != null ? Number(s.defaultVatPercent) : 0
    })

    const createDialog = ref(false)
    const generateDialog = ref(false)
    const receiveDialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const receiveError = ref('')
    const selectedRequest = ref<any>(null)

    const form = reactive({
      objectId: '',
      contractorId: '',
      notes: '',
    })
    const items = ref<RequestItemRow[]>([])

    const generateForm = reactive({
      objectId: '',
      contractorId: '',
    })

    const receiveForm = reactive({
      number: '',
      warehouseId: '',
      contractorId: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    })
    const receivePrices = reactive<Record<string, number>>({})

    const statusOptions = [
      { title: 'Всі', value: null },
      { title: 'Чернетки', value: 'DRAFT' },
      { title: 'Погоджено', value: 'APPROVED' },
      { title: 'Замовлено', value: 'ORDERED' },
      { title: 'Отримано', value: 'RECEIVED' },
    ]

    const headers = [
      { title: 'Обʼєкт', key: 'object.name', minWidth: 180 },
      { title: 'Контрагент', key: 'contractor.name', minWidth: 160 },
      { title: 'Статус', key: 'status', width: 130 },
      { title: 'Позицій', key: 'items', sortable: false, width: 95 },
      { title: 'Сума, ₴', key: 'total', align: 'end' as const, sortable: false, width: 130 },
      { title: 'Накладна', key: 'invoice', sortable: false, width: 140 },
      { title: 'Автор', key: 'createdBy.name', width: 140 },
      { title: 'Дата', key: 'createdAt', width: 120 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 240 },
    ]

    function uah(value: number) {
      return `₴${value.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    function requestTotal(request: any) {
      return (request.items ?? []).reduce(
        (sum: number, item: any) => {
          const base = Number(item.quantity) * Number(item.estimatedPricePerUnit)
          return sum + base * (1 + Number(item.vatPercent || 0) / 100)
        },
        0,
      )
    }

    function resetCreateForm() {
      form.objectId = objects.value[0]?.id ?? ''
      form.contractorId = ''
      form.notes = ''
      items.value = [{ productId: '', quantity: 1, estimatedPricePerUnit: 0, vatPercent: defaultVatPercent.value }]
      error.value = ''
    }

    function openCreate() {
      resetCreateForm()
      createDialog.value = true
    }

    function addItem() {
      items.value.push({ productId: '', quantity: 1, estimatedPricePerUnit: 0, vatPercent: defaultVatPercent.value })
    }

    function removeItem(index: number) {
      items.value.splice(index, 1)
    }

    function onProductChange(index: number, productId: string) {
      const row = items.value[index]
      if (!row) return
      row.productId = productId
      if (!row.estimatedPricePerUnit) {
        row.estimatedPricePerUnit = 0
      }
    }

    async function saveManual() {
      error.value = ''
      if (!form.objectId) {
        error.value = 'Оберіть обʼєкт'
        return
      }
      if (!items.value.length || items.value.some((item) => !item.productId || Number(item.quantity) <= 0)) {
        error.value = 'Перевірте позиції заявки'
        return
      }

      saving.value = true
      try {
        await $fetch('/api/purchase-requests', {
          method: 'POST',
          body: {
            ...form,
            items: items.value.map((item) => ({
              productId: item.productId,
              quantity: Number(item.quantity),
              estimatedPricePerUnit: Number(item.estimatedPricePerUnit) || 0,
              vatPercent: Number(item.vatPercent) || 0,
              note: item.note || undefined,
            })),
          },
        })
        createDialog.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження заявки'
      } finally {
        saving.value = false
      }
    }

    function openGenerate() {
      generateForm.objectId = objects.value[0]?.id ?? ''
      generateForm.contractorId = ''
      error.value = ''
      generateDialog.value = true
    }

    async function generateFromObject() {
      error.value = ''
      if (!generateForm.objectId) {
        error.value = 'Оберіть обʼєкт'
        return
      }

      saving.value = true
      try {
        await $fetch('/api/purchase-requests/generate-from-object', {
          method: 'POST',
          body: { objectId: generateForm.objectId, contractorId: generateForm.contractorId || null },
        })
        generateDialog.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Не вдалося сформувати заявку'
      } finally {
        saving.value = false
      }
    }

    async function setStatus(request: any, status: string) {
      saving.value = true
      try {
        await $fetch(`/api/purchase-requests/${request.id}`, {
          method: 'PUT',
          body: { status },
        })
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Не вдалося змінити статус'
      } finally {
        saving.value = false
      }
    }

    function openReceive(request: any) {
      selectedRequest.value = request
      receiveError.value = ''
      receiveForm.number = `PR-${new Date().toISOString().slice(0, 10)}-${request.id.slice(-4)}`
      receiveForm.warehouseId = warehouses.value[0]?.id ?? ''
      receiveForm.contractorId = request.contractorId ?? ''
      receiveForm.date = new Date().toISOString().split('T')[0]
      receiveForm.notes = `Прихід за заявкою на закупівлю для обʼєкта "${request.object?.name ?? ''}"`
      for (const key of Object.keys(receivePrices)) delete receivePrices[key]
      for (const item of request.items ?? []) {
        receivePrices[item.id] = Number(item.estimatedPricePerUnit) || 0
      }
      receiveDialog.value = true
    }

    async function receiveRequest() {
      if (!selectedRequest.value) return
      receiveError.value = ''
      if (!receiveForm.number || !receiveForm.warehouseId || !receiveForm.date) {
        receiveError.value = 'Вкажіть номер накладної, склад і дату'
        return
      }

      saving.value = true
      try {
        await $fetch(`/api/purchase-requests/${selectedRequest.value.id}/receive`, {
          method: 'POST',
          body: {
            ...receiveForm,
            prices: receivePrices,
          },
        })
        receiveDialog.value = false
        await refresh()
      } catch (e: any) {
        receiveError.value = e?.data?.statusMessage || 'Не вдалося отримати товар'
      } finally {
        saving.value = false
      }
    }

    function itemLines(request: any) {
      const list = request.items ?? []
      if (!list.length) return <span class="text-medium-emphasis">—</span>
      return (
        <div class="d-flex flex-column gap-1">
          {list.slice(0, 3).map((item: any) => (
            <div key={item.id} class="text-caption">
              <span class="font-weight-medium">{item.product?.name ?? '—'}</span>
              {' · '}
              {Number(item.quantity).toLocaleString('uk-UA')} {item.product?.unit ?? ''}
            </div>
          ))}
          {list.length > 3 && <div class="text-caption text-medium-emphasis">+{list.length - 3} ще</div>}
        </div>
      )
    }

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Заявки на закупівлю</div>
          <v-spacer />
          <v-btn variant="tonal" color="secondary" prepend-icon="mdi-auto-fix" class="mr-2" onClick={openGenerate}>
            Сформувати з обʼєкта
          </v-btn>
          <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
            Нова заявка
          </v-btn>
        </div>

        {error.value && (
          <v-alert type="error" variant="tonal" closable class="mb-4" onUpdate:modelValue={() => (error.value = '')}>
            {error.value}
          </v-alert>
        )}

        <v-card>
          <v-card-text class="pb-0">
            <v-btn-toggle v-model={filterStatus.value} rounded="lg" density="compact" class="mb-2">
              {statusOptions.map((option) => (
                <v-btn key={String(option.value)} value={option.value}>
                  {option.title}
                </v-btn>
              ))}
            </v-btn-toggle>
          </v-card-text>
          <v-data-table headers={headers} items={purchaseRequests.value} loading={pending.value} hover>
            {{
              'item.status': ({ item }: any) => (
                <v-chip size="small" color={STATUS_COLORS[item.status]} variant="tonal">
                  {STATUS_LABELS[item.status]}
                </v-chip>
              ),
              'item.contractor.name': ({ item }: any) => (
                <span>{item.contractor?.name ?? '—'}</span>
              ),
              'item.items': ({ item }: any) => (
                <v-menu location="bottom">
                  {{
                    activator: ({ props }: { props: Record<string, unknown> }) => (
                      <v-chip {...props} size="small" variant="outlined">{item.items?.length ?? 0}</v-chip>
                    ),
                    default: () => <v-card class="pa-3" min-width={260}>{itemLines(item)}</v-card>,
                  }}
                </v-menu>
              ),
              'item.total': ({ item }: any) => <strong>{uah(requestTotal(item))}</strong>,
              'item.invoice': ({ item }: any) =>
                item.invoice ? (
                  <v-btn variant="text" size="small" color="primary" to={`/invoices/${item.invoice.id}`}>
                    № {item.invoice.number}
                  </v-btn>
                ) : (
                  <span class="text-medium-emphasis">—</span>
                ),
              'item.createdAt': ({ item }: any) => (
                <span>{new Date(item.createdAt).toLocaleDateString('uk-UA')}</span>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end">
                  <v-btn icon="mdi-eye" variant="text" size="small" to={`/purchase-requests/${item.id}`} />
                  {item.status === 'DRAFT' && (
                    <v-btn size="small" variant="tonal" color="primary" onClick={() => setStatus(item, 'APPROVED')}>
                      Погодити
                    </v-btn>
                  )}
                  {item.status === 'APPROVED' && (
                    <v-btn size="small" variant="tonal" color="warning" onClick={() => setStatus(item, 'ORDERED')}>
                      Замовлено
                    </v-btn>
                  )}
                  {item.status !== 'RECEIVED' && (
                    <v-btn size="small" variant="flat" color="success" onClick={() => openReceive(item)}>
                      Отримати
                    </v-btn>
                  )}
                </div>
              ),
            }}
          </v-data-table>
        </v-card>

        <v-dialog v-model={createDialog.value} max-width={1060} scrollable>
          <v-card>
            <v-card-title>Нова заявка на закупівлю</v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-autocomplete
                v-model={form.objectId}
                label="Обʼєкт *"
                items={objects.value}
                item-title="name"
                item-value="id"
                class="mb-3"
              />
              <v-autocomplete
                v-model={form.contractorId}
                label="Контрагент"
                items={contractors.value}
                item-title="name"
                item-value="id"
                clearable
                class="mb-3"
              />
              <v-textarea v-model={form.notes} label="Примітки" rows={2} class="mb-3" />

              <div class="d-flex align-center mb-2">
                <div class="text-subtitle-1 font-weight-medium">Позиції</div>
                <v-spacer />
                <v-btn size="small" color="primary" prepend-icon="mdi-plus" onClick={addItem}>
                  Додати
                </v-btn>
              </div>

              {items.value.map((item, index) => (
                <v-row key={index} align="center" class="mb-1">
                  <v-col cols={12} md={3}>
                    <v-autocomplete
                      v-model={item.productId}
                      label="Товар *"
                      items={products.value}
                      item-title="name"
                      item-value="id"
                      hide-details
                      onChange={(value: string) => onProductChange(index, value)}
                    />
                  </v-col>
                  <v-col cols={6} md={2}>
                    <v-text-field v-model={item.quantity} label="К-сть *" type="number" min={0.001} step={0.001} hide-details />
                  </v-col>
                  <v-col cols={6} md={2}>
                    <v-text-field
                      v-model={item.estimatedPricePerUnit}
                      label="Ціна без ПДВ"
                      type="number"
                      min={0}
                      step={0.01}
                      prefix="₴"
                      hide-details
                    />
                  </v-col>
                  <v-col cols={4} md={2}>
                    <v-text-field
                      v-model={item.vatPercent}
                      label="ПДВ %"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      hide-details
                    />
                  </v-col>
                  <v-col cols={6} md={2}>
                    <v-text-field v-model={item.note} label="Коментар" hide-details />
                  </v-col>
                  <v-col cols={2} md={1}>
                    <v-btn icon="mdi-delete" variant="text" color="error" size="small" onClick={() => removeItem(index)} />
                  </v-col>
                </v-row>
              ))}
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" disabled={saving.value} onClick={() => (createDialog.value = false)}>Скасувати</v-btn>
              <v-btn color="primary" variant="flat" loading={saving.value} onClick={saveManual}>Створити</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model={generateDialog.value} max-width={560}>
          <v-card>
            <v-card-title>Сформувати з потреб обʼєкта</v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <p class="text-body-2 text-medium-emphasis mb-3">
                Система бере товари, які вже відпускались на обʼєкт, і віднімає залишок на обʼєкті, резерви на складах та відкриті заявки.
              </p>
              <v-autocomplete
                v-model={generateForm.objectId}
                label="Обʼєкт *"
                items={objects.value}
                item-title="name"
                item-value="id"
                class="mb-3"
              />
              <v-autocomplete
                v-model={generateForm.contractorId}
                label="Контрагент"
                items={contractors.value}
                item-title="name"
                item-value="id"
                clearable
              />
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" disabled={saving.value} onClick={() => (generateDialog.value = false)}>Скасувати</v-btn>
              <v-btn color="secondary" variant="flat" loading={saving.value} onClick={generateFromObject}>Сформувати</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model={receiveDialog.value} max-width={760} scrollable>
          <v-card>
            <v-card-title>Отримати товар і створити прихідну накладну</v-card-title>
            <v-card-text>
              {receiveError.value && <v-alert type="error" variant="tonal" class="mb-3">{receiveError.value}</v-alert>}
              <v-row>
                <v-col cols={12} md={4}>
                  <v-text-field v-model={receiveForm.number} label="Номер накладної *" />
                </v-col>
                <v-col cols={12} md={4}>
                  <v-text-field v-model={receiveForm.date} label="Дата *" type="date" />
                </v-col>
                <v-col cols={12} md={4}>
                  <v-select v-model={receiveForm.warehouseId} label="Склад *" items={warehouses.value} item-title="name" item-value="id" />
                </v-col>
              </v-row>
              <v-autocomplete
                v-model={receiveForm.contractorId}
                label="Контрагент"
                items={contractors.value}
                item-title="name"
                item-value="id"
                clearable
                class="mb-3"
              />
              <v-textarea v-model={receiveForm.notes} label="Примітки до накладної" rows={2} class="mb-3" />

              <div class="text-subtitle-1 font-weight-medium mb-2">Ціни у накладній</div>
              {(selectedRequest.value?.items ?? []).map((item: any) => (
                <v-row key={item.id} align="center" class="mb-1">
                  <v-col cols={12} md={7}>
                    <div class="text-body-2 font-weight-medium">{item.product?.name ?? '—'}</div>
                    <div class="text-caption text-medium-emphasis">
                      {Number(item.quantity).toLocaleString('uk-UA')} {item.product?.unit ?? ''}
                    </div>
                  </v-col>
                  <v-col cols={12} md={5}>
                    <v-text-field
                      v-model={receivePrices[item.id]}
                      label="Ціна за од."
                      type="number"
                      min={0}
                      step={0.01}
                      prefix="₴"
                      hide-details
                    />
                  </v-col>
                </v-row>
              ))}
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" disabled={saving.value} onClick={() => (receiveDialog.value = false)}>Скасувати</v-btn>
              <v-btn color="success" variant="flat" loading={saving.value} onClick={receiveRequest}>Отримати</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
