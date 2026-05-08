interface RequestItemRow {
  productId: string
  quantity: number
  estimatedPricePerUnit: number
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
  name: 'PurchaseRequestDetailPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const id = route.params.id as string
    const { data, pending, refresh } = useFetch(`/api/purchase-requests/${id}`)
    const { data: objectsData } = useFetch('/api/objects')
    const { data: productsData } = useFetch('/api/products')
    const { data: contractorsData } = useFetch('/api/contractors')

    const purchaseRequest = computed(() => (data.value as any)?.purchaseRequest)
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])
    const products = computed(() => (productsData.value as any)?.products ?? [])
    const contractors = computed(() => (contractorsData.value as any)?.contractors ?? [])
    const canEdit = computed(() => purchaseRequest.value?.status !== 'RECEIVED')

    useHead({
      title: computed(() =>
        purchaseRequest.value ? `Заявка: ${purchaseRequest.value.object?.name ?? purchaseRequest.value.id}` : 'Заявка на закупівлю',
      ),
    })

    const editing = ref(false)
    const saving = ref(false)
    const error = ref('')

    const form = reactive({
      objectId: '',
      contractorId: '',
      status: 'DRAFT',
      notes: '',
    })
    const items = ref<RequestItemRow[]>([])

    const itemHeaders = [
      { title: 'Товар', key: 'product.name', minWidth: 180 },
      { title: 'Артикул', key: 'product.sku', width: 120 },
      { title: 'Кількість', key: 'quantity', align: 'end' as const, width: 130 },
      { title: 'Ціна', key: 'estimatedPricePerUnit', align: 'end' as const, width: 130 },
      { title: 'Сума', key: 'total', align: 'end' as const, width: 130 },
      { title: 'Коментар', key: 'note', minWidth: 160 },
    ]

    const statusOptions = [
      { title: 'Чернетка', value: 'DRAFT' },
      { title: 'Погоджено', value: 'APPROVED' },
      { title: 'Замовлено', value: 'ORDERED' },
    ]

    const totalSum = computed(() =>
      (purchaseRequest.value?.items ?? []).reduce(
        (sum: number, item: any) => sum + Number(item.quantity) * Number(item.estimatedPricePerUnit),
        0,
      ),
    )

    const editTotal = computed(() =>
      items.value.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.estimatedPricePerUnit || 0),
        0,
      ),
    )

    function uah(value: number) {
      return `₴${value.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    function fillForm() {
      const request = purchaseRequest.value
      if (!request) return
      form.objectId = request.objectId
      form.contractorId = request.contractorId ?? ''
      form.status = request.status
      form.notes = request.notes ?? ''
      items.value = (request.items ?? []).map((item: any) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        estimatedPricePerUnit: Number(item.estimatedPricePerUnit) || 0,
        note: item.note ?? '',
      }))
    }

    watch(purchaseRequest, () => {
      if (!editing.value) fillForm()
    }, { immediate: true })

    function startEdit() {
      fillForm()
      error.value = ''
      editing.value = true
    }

    function cancelEdit() {
      fillForm()
      error.value = ''
      editing.value = false
    }

    function addItem() {
      items.value.push({ productId: '', quantity: 1, estimatedPricePerUnit: 0, note: '' })
    }

    function removeItem(index: number) {
      items.value.splice(index, 1)
    }

    async function save() {
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
        await $fetch(`/api/purchase-requests/${id}`, {
          method: 'PUT',
          body: {
            objectId: form.objectId,
            contractorId: form.contractorId || null,
            status: form.status,
            notes: form.notes,
            items: items.value.map((item) => ({
              productId: item.productId,
              quantity: Number(item.quantity),
              estimatedPricePerUnit: Number(item.estimatedPricePerUnit) || 0,
              note: item.note || undefined,
            })),
          },
        })
        editing.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження заявки'
      } finally {
        saving.value = false
      }
    }

    return () => (
      <div>
        <div class="page-toolbar">
          <v-btn icon="mdi-arrow-left" variant="text" to="/purchase-requests" class="mr-2" />
          {purchaseRequest.value && (
            <>
              <div>
                <div class="text-h5 font-weight-bold">
                  Заявка на закупівлю
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {purchaseRequest.value.object?.name ?? 'Без обʼєкта'} · {new Date(purchaseRequest.value.createdAt).toLocaleDateString('uk-UA')}
                </div>
              </div>
              <v-chip class="ml-3" color={STATUS_COLORS[purchaseRequest.value.status]} variant="tonal">
                {STATUS_LABELS[purchaseRequest.value.status]}
              </v-chip>
            </>
          )}
          <v-spacer />
          {purchaseRequest.value && canEdit.value && !editing.value && (
            <v-btn color="primary" prepend-icon="mdi-pencil" onClick={startEdit}>
              Редагувати
            </v-btn>
          )}
        </div>

        {pending.value && <v-progress-linear indeterminate color="primary" />}

        {error.value && (
          <v-alert type="error" variant="tonal" closable class="mb-4" onUpdate:modelValue={() => (error.value = '')}>
            {error.value}
          </v-alert>
        )}

        {purchaseRequest.value && !editing.value && (
          <v-row>
            <v-col cols={12} md={4}>
              <v-card class="mb-4">
                <v-list lines="two">
                  <v-list-item title="Обʼєкт" subtitle={purchaseRequest.value.object?.name ?? '—'} prepend-icon="mdi-office-building-outline" />
                  <v-list-item title="Клієнт" subtitle={purchaseRequest.value.object?.client?.name ?? '—'} prepend-icon="mdi-account-tie" />
                  <v-list-item title="Контрагент" subtitle={purchaseRequest.value.contractor?.name ?? '—'} prepend-icon="mdi-domain" />
                  <v-list-item title="Створив" subtitle={purchaseRequest.value.createdBy?.name ?? '—'} prepend-icon="mdi-account" />
                  <v-list-item title="Дата створення" subtitle={new Date(purchaseRequest.value.createdAt).toLocaleDateString('uk-UA')} prepend-icon="mdi-calendar" />
                  {purchaseRequest.value.invoice ? (
                    <v-list-item title="Накладна" prepend-icon="mdi-file-document-check-outline">
                      {{
                        subtitle: () => (
                          <v-btn variant="text" size="small" color="primary" to={`/invoices/${purchaseRequest.value.invoice.id}`}>
                            № {purchaseRequest.value.invoice.number}
                          </v-btn>
                        ),
                      }}
                    </v-list-item>
                  ) : (
                    <v-list-item title="Накладна" subtitle="—" prepend-icon="mdi-file-document-outline" />
                  )}
                  {purchaseRequest.value.notes && (
                    <v-list-item title="Примітки" subtitle={purchaseRequest.value.notes} prepend-icon="mdi-note-text" />
                  )}
                </v-list>
              </v-card>
            </v-col>

            <v-col cols={12} md={8}>
              <v-card>
                <v-card-title>Позиції</v-card-title>
                <v-data-table headers={itemHeaders} items={purchaseRequest.value.items ?? []} hide-default-footer>
                  {{
                    'item.product.sku': ({ item }: any) => <span>{item.product?.sku || '—'}</span>,
                    'item.quantity': ({ item }: any) => (
                      <span>{Number(item.quantity).toLocaleString('uk-UA')} {item.product?.unit ?? ''}</span>
                    ),
                    'item.estimatedPricePerUnit': ({ item }: any) => (
                      <span>{uah(Number(item.estimatedPricePerUnit) || 0)}</span>
                    ),
                    'item.total': ({ item }: any) => (
                      <strong>{uah(Number(item.quantity) * Number(item.estimatedPricePerUnit || 0))}</strong>
                    ),
                    'item.note': ({ item }: any) => <span class="text-medium-emphasis">{item.note || '—'}</span>,
                    'body.append': () => (
                      <tr>
                        <td colspan={4} class="text-right font-weight-bold pa-3">Всього:</td>
                        <td class="text-right font-weight-bold pa-3">{uah(totalSum.value)}</td>
                        <td />
                      </tr>
                    ),
                  }}
                </v-data-table>
              </v-card>
            </v-col>
          </v-row>
        )}

        {purchaseRequest.value && editing.value && (
          <v-card>
            <v-card-title>Редагування заявки</v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols={12} md={8}>
                  <v-autocomplete
                    v-model={form.objectId}
                    label="Обʼєкт *"
                    items={objects.value}
                    item-title="name"
                    item-value="id"
                  />
                </v-col>
                <v-col cols={12} md={4}>
                  <v-select
                    v-model={form.status}
                    label="Статус *"
                    items={statusOptions}
                    item-title="title"
                    item-value="value"
                  />
                </v-col>
              </v-row>
              <v-autocomplete
                v-model={form.contractorId}
                label="Контрагент"
                items={contractors.value}
                item-title="name"
                item-value="id"
                clearable
                class="mb-4"
              />
              <v-textarea v-model={form.notes} label="Примітки" rows={2} class="mb-4" />

              <div class="d-flex align-center mb-2">
                <div class="text-subtitle-1 font-weight-medium">Позиції</div>
                <v-spacer />
                <v-btn size="small" color="primary" prepend-icon="mdi-plus" onClick={addItem}>
                  Додати
                </v-btn>
              </div>

              {items.value.map((item, index) => (
                <v-row key={index} align="center" class="mb-1">
                  <v-col cols={12} md={5}>
                    <v-autocomplete
                      v-model={item.productId}
                      label="Товар *"
                      items={products.value}
                      item-title="name"
                      item-value="id"
                      hide-details
                    />
                  </v-col>
                  <v-col cols={6} md={2}>
                    <v-text-field v-model={item.quantity} label="К-сть *" type="number" min={0.001} step={0.001} hide-details />
                  </v-col>
                  <v-col cols={6} md={2}>
                    <v-text-field
                      v-model={item.estimatedPricePerUnit}
                      label="Ціна"
                      type="number"
                      min={0}
                      step={0.01}
                      prefix="₴"
                      hide-details
                    />
                  </v-col>
                  <v-col cols={10} md={2}>
                    <v-text-field v-model={item.note} label="Коментар" hide-details />
                  </v-col>
                  <v-col cols={2} md={1}>
                    <v-btn icon="mdi-delete" variant="text" color="error" size="small" onClick={() => removeItem(index)} />
                  </v-col>
                </v-row>
              ))}

              <v-divider class="my-4" />
              <div class="d-flex justify-end text-h6">
                <span class="text-medium-emphasis text-body-1 mr-2">Всього:</span>
                <span class="font-weight-bold">{uah(editTotal.value)}</span>
              </div>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="outlined" disabled={saving.value} onClick={cancelEdit}>
                Скасувати
              </v-btn>
              <v-btn color="primary" variant="flat" loading={saving.value} onClick={save}>
                Зберегти
              </v-btn>
            </v-card-actions>
          </v-card>
        )}
      </div>
    )
  },
})
