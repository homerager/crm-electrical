interface InvoiceItemRow {
  productId: string
  quantity: number
  pricePerUnit: number
  vatPercent: number
  _product?: any
  _rawName?: string
}

interface ParsedPdfFile {
  storedAs: string
  filename: string
  mimeType: string
  size: number
}

type DestinationType = 'warehouse' | 'object'

export default defineComponent({
  name: 'InvoiceCreatePage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({
      title: 'Нова накладна'
    })

    const router = useRouter()
    const toast = useToast()
    const { data: warehousesData } = useFetch('/api/warehouses')
    const { data: contractorsData } = useFetch('/api/contractors')
    const { data: productsData } = useFetch('/api/products')
    const { data: objectsData } = useFetch('/api/objects')
    const { data: settingsData } = useFetch('/api/settings')

    const warehouses = computed(() => (warehousesData.value as any)?.warehouses ?? [])
    const contractors = computed(() => (contractorsData.value as any)?.contractors ?? [])
    const products = computed(() => (productsData.value as any)?.products ?? [])
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])
    const defaultVatPercent = computed(() => {
      const s = (settingsData.value as any)?.settings
      return s?.defaultVatPercent != null ? Number(s.defaultVatPercent) : 0
    })

    const destinationType = ref<DestinationType>('warehouse')

    const form = reactive({
      number: '',
      type: 'INCOMING',
      warehouseId: '',
      objectId: '',
      contractorId: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    })

    watch(destinationType, () => {
      form.warehouseId = ''
      form.objectId = ''
    })

    const items = ref<InvoiceItemRow[]>([])
    const saving = ref(false)
    const error = ref('')

    const pdfFile = ref<ParsedPdfFile | null>(null)
    const pdfInput = ref<HTMLInputElement | null>(null)
    const parsing = ref(false)
    const parseWarnings = ref<string[]>([])
    const unmatchedItems = ref<string[]>([])

    const typeOptions = [
      { title: 'Прихід', value: 'INCOMING' },
      { title: 'Видаток', value: 'OUTGOING' },
    ]

    const destinationOptions = [
      { title: 'Склад', value: 'warehouse' },
      { title: 'Обʼєкт', value: 'object' },
    ]

    function addItem() {
      items.value.push({ productId: '', quantity: 1, pricePerUnit: 0, vatPercent: defaultVatPercent.value })
    }

    function removeItem(index: number) {
      items.value.splice(index, 1)
    }

    function onProductChange(index: number, productId: string) {
      const product = products.value.find((p: any) => p.id === productId)
      items.value[index]._product = product
    }

    function openPdfPicker() {
      pdfInput.value?.click()
    }

    async function onPdfSelected(e: Event) {
      const input = e.target as HTMLInputElement
      const file = input.files?.[0]
      input.value = ''
      if (!file) return
      if (!/pdf/i.test(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Виберіть PDF файл')
        return
      }

      parsing.value = true
      parseWarnings.value = []
      unmatchedItems.value = []
      try {
        const fd = new FormData()
        fd.append('file', file, file.name)
        const result: any = await $fetch('/api/invoices/parse-pdf', { method: 'POST', body: fd })
        pdfFile.value = result.file
        applyParsed(result.parsed)
        toast.success('PDF розпізнано — перевірте дані')
      } catch (e: any) {
        toast.error(e?.data?.statusMessage || 'Не вдалося обробити PDF')
      } finally {
        parsing.value = false
      }
    }

    function applyParsed(parsed: any) {
      if (!parsed) return
      if (parsed.number && !form.number) form.number = parsed.number
      if (parsed.date && form.date === new Date().toISOString().split('T')[0]) {
        form.date = parsed.date
      } else if (parsed.date && !form.date) {
        form.date = parsed.date
      }
      if (parsed.contractorId && !form.contractorId) {
        form.contractorId = parsed.contractorId
      }
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        const newRows: InvoiceItemRow[] = []
        const unmatched: string[] = []
        for (const it of parsed.items) {
          const row: InvoiceItemRow = {
            productId: it.productId || '',
            quantity: Number(it.quantity) || 0,
            pricePerUnit: Number(it.pricePerUnit) || 0,
            vatPercent: it.vatPercent != null ? Number(it.vatPercent) : defaultVatPercent.value,
            _rawName: it.rawName,
          }
          if (it.productId) {
            const product = products.value.find((p: any) => p.id === it.productId)
            if (product) row._product = product
          } else if (it.rawName) {
            unmatched.push(it.rawName)
          }
          newRows.push(row)
        }
        items.value = newRows
        unmatchedItems.value = unmatched
      }
      if (Array.isArray(parsed.warnings)) parseWarnings.value = parsed.warnings
      if (parsed.contractorName && !parsed.contractorId) {
        parseWarnings.value = [
          ...parseWarnings.value,
          `Контрагента "${parsed.contractorName}" не знайдено в довіднику — виберіть вручну або додайте.`,
        ]
      }
    }

    function clearPdf() {
      pdfFile.value = null
      parseWarnings.value = []
      unmatchedItems.value = []
    }

    async function save() {
      error.value = ''
      const hasDestination = destinationType.value === 'warehouse' ? form.warehouseId : form.objectId
      if (!form.number || !hasDestination || !form.date) {
        error.value = 'Заповніть всі обовʼязкові поля'
        return
      }
      if (items.value.length === 0) {
        error.value = 'Додайте хоча б один товар'
        return
      }
      if (items.value.some((i) => !i.productId || i.quantity <= 0)) {
        error.value = 'Перевірте всі позиції накладної'
        return
      }

      saving.value = true
      try {
        const payload: any = {
          number: form.number,
          type: form.type,
          contractorId: form.contractorId,
          date: form.date,
          notes: form.notes,
          items: items.value.map((i) => ({ productId: i.productId, quantity: i.quantity, pricePerUnit: i.pricePerUnit, vatPercent: i.vatPercent })),
        }
        if (destinationType.value === 'warehouse') {
          payload.warehouseId = form.warehouseId
        } else {
          payload.objectId = form.objectId
        }
        if (pdfFile.value) {
          payload.pdf = pdfFile.value
        }

        const result = await $fetch('/api/invoices', {
          method: 'POST',
          body: payload,
        })
        toast.success('Накладну створено')
        await router.push(`/invoices/${(result as any).invoice.id}`)
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
        toast.error(error.value)
      } finally {
        saving.value = false
      }
    }

    return () => (
      <div>
        <div class="page-toolbar">
          <v-btn icon="mdi-arrow-left" variant="text" to="/invoices" class="mr-2" />
          <div class="text-h5 font-weight-bold">Нова накладна</div>
        </div>

        {error.value && (
          <v-alert type="error" variant="tonal" class="mb-4" closable onUpdate:modelValue={() => (error.value = '')}>
            {error.value}
          </v-alert>
        )}

        <v-card class="mb-4" variant="tonal" color="primary">
          <v-card-text class="d-flex align-center flex-wrap gap-3">
            <v-icon icon="mdi-file-pdf-box" size="32" />
            <div class="flex-grow-1">
              <div class="text-subtitle-1 font-weight-medium">
                {pdfFile.value ? pdfFile.value.filename : 'Завантажити PDF накладної'}
              </div>
              <div class="text-caption text-medium-emphasis">
                {pdfFile.value
                  ? `${(pdfFile.value.size / 1024).toFixed(1)} КБ — PDF буде прикріплено до накладної`
                  : 'Система автоматично спробує розпізнати номер, дату, контрагента та позиції'}
              </div>
            </div>
            <input
              ref={pdfInput}
              type="file"
              accept="application/pdf,.pdf"
              style="display: none"
              onChange={onPdfSelected}
            />
            {!pdfFile.value ? (
              <v-btn
                color="primary"
                variant="elevated"
                prepend-icon="mdi-upload"
                loading={parsing.value}
                onClick={openPdfPicker}
              >
                Вибрати PDF
              </v-btn>
            ) : (
              <>
                <v-btn
                  variant="outlined"
                  prepend-icon="mdi-refresh"
                  loading={parsing.value}
                  onClick={openPdfPicker}
                >
                  Замінити
                </v-btn>
                <v-btn
                  variant="text"
                  color="error"
                  prepend-icon="mdi-close"
                  onClick={clearPdf}
                >
                  Прибрати
                </v-btn>
              </>
            )}
          </v-card-text>
          {(parseWarnings.value.length > 0 || unmatchedItems.value.length > 0) && (
            <v-card-text class="pt-0">
              {parseWarnings.value.map((w, i) => (
                <v-alert key={i} type="warning" variant="tonal" density="compact" class="mb-2">
                  {w}
                </v-alert>
              ))}
              {unmatchedItems.value.length > 0 && (
                <v-alert type="info" variant="tonal" density="compact">
                  <div class="text-caption font-weight-medium mb-1">
                    Не знайдено в довіднику товарів ({unmatchedItems.value.length}):
                  </div>
                  <ul class="ml-4 text-caption">
                    {unmatchedItems.value.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                  <div class="text-caption mt-2">
                    Виберіть товар вручну у відповідних позиціях або створіть нові у довіднику.
                  </div>
                </v-alert>
              )}
            </v-card-text>
          )}
        </v-card>

        <v-row>
          <v-col cols={12} md={8}>
            <v-card class="mb-4">
              <v-card-title>Основні дані</v-card-title>
              <v-card-text>
                <v-row>
                  <v-col cols={12} md={4}>
                    <v-text-field v-model={form.number} label="Номер накладної *" />
                  </v-col>
                  <v-col cols={12} md={4}>
                    <v-select v-model={form.type} label="Тип *" items={typeOptions} item-title="title" item-value="value" />
                  </v-col>
                  <v-col cols={12} md={4}>
                    <v-text-field v-model={form.date} label="Дата *" type="date" />
                  </v-col>
                </v-row>
                <v-row>
                  <v-col cols={12} md={12}>
                    <v-btn-toggle
                        v-model={destinationType.value}
                        mandatory
                        rounded="lg"
                        density="compact"
                        color="primary"
                        class="mb-3"
                      >
                        {destinationOptions.map((opt) => (
                          <v-btn key={opt.value} value={opt.value}>
                            {opt.title}
                          </v-btn>
                        ))}
                      </v-btn-toggle>
                  </v-col>
                </v-row>
                <v-row >
                  <v-col cols={12} md={6}>
                    {destinationType.value === 'warehouse' ? (
                      <v-select
                        v-model={form.warehouseId}
                        label="Склад *"
                        items={warehouses.value}
                        item-title="name"
                        item-value="id"
                      />
                    ) : (
                      <v-autocomplete
                        v-model={form.objectId}
                        label="Обʼєкт *"
                        items={objects.value}
                        item-title="name"
                        item-value="id"
                      />
                    )}
                  </v-col>
                  <v-col cols={12} md={6}>
                    <v-autocomplete
                      v-model={form.contractorId}
                      label="Контрагент"
                      items={contractors.value}
                      item-title="name"
                      item-value="id"
                      clearable
                    />
                  </v-col>
                </v-row>
                <v-textarea v-model={form.notes} label="Примітки" rows={2} />
              </v-card-text>
            </v-card>

            <v-card>
              <v-card-title class="d-flex align-center">
                Позиції накладної
                <v-spacer />
                <v-btn size="small" color="primary" prepend-icon="mdi-plus" onClick={addItem}>
                  Додати позицію
                </v-btn>
              </v-card-title>
              <v-card-text>
                {items.value.length === 0 && (
                  <v-alert type="info" variant="tonal">
                    Натисніть "Додати позицію" щоб додати товар
                  </v-alert>
                )}
                {items.value.map((item, index) => (
                  <v-row key={index} align="center" class="mb-2">
                    <v-col cols={12} md={4}>
                      <v-autocomplete
                        v-model={item.productId}
                        label="Товар *"
                        items={products.value}
                        item-title="name"
                        item-value="id"
                        hide-details
                        hint={item._rawName && !item.productId ? `З PDF: ${item._rawName}` : undefined}
                        persistent-hint={!!(item._rawName && !item.productId)}
                        onChange={(val: string) => onProductChange(index, val)}
                      />
                    </v-col>
                    <v-col cols={6} md={2}>
                      <v-text-field
                        v-model={item.quantity}
                        label="Кількість *"
                        type="number"
                        min={0.001}
                        step={0.001}
                        hide-details
                        suffix={item._product?.unit || ''}
                      />
                    </v-col>
                    <v-col cols={6} md={3}>
                      <v-text-field
                        v-model={item.pricePerUnit}
                        label="Ціна без ПДВ, ₴"
                        type="number"
                        min={0}
                        step={0.01}
                        hide-details
                        prefix="₴"
                      />
                    </v-col>
                    <v-col cols={10} md={2}>
                      <v-text-field
                        v-model={item.vatPercent}
                        label="ПДВ, %"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        hide-details
                        suffix="%"
                      />
                    </v-col>
                    <v-col cols={2} md={1}>
                      <v-btn icon="mdi-delete" variant="text" color="error" size="small" onClick={() => removeItem(index)} />
                    </v-col>
                  </v-row>
                ))}
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols={12} md={4}>
            <v-card>
              <v-card-title>Підсумок</v-card-title>
              <v-card-text>
                {{
                  default: () => {
                    const baseTotal = items.value.reduce((s, i) => s + Number(i.quantity) * Number(i.pricePerUnit), 0)
                    const vatTotal = items.value.reduce((s, i) => s + Number(i.quantity) * Number(i.pricePerUnit) * Number(i.vatPercent || 0) / 100, 0)
                    const hasVat = items.value.some((i) => Number(i.vatPercent) > 0)
                    return (
                      <>
                        <div class="d-flex justify-space-between mb-2">
                          <span class="text-medium-emphasis">Позицій:</span>
                          <strong>{items.value.length}</strong>
                        </div>
                        <div class="d-flex justify-space-between mb-2">
                          <span class="text-medium-emphasis">Без ПДВ:</span>
                          <strong>₴{baseTotal.toLocaleString('uk-UA', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        {hasVat && (
                          <>
                            <div class="d-flex justify-space-between mb-2">
                              <span class="text-medium-emphasis">ПДВ:</span>
                              <span>₴{vatTotal.toLocaleString('uk-UA', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <v-divider class="mb-2" />
                            <div class="d-flex justify-space-between mb-2">
                              <span class="font-weight-bold">Всього з ПДВ:</span>
                              <strong class="text-primary">₴{(baseTotal + vatTotal).toLocaleString('uk-UA', { minimumFractionDigits: 2 })}</strong>
                            </div>
                          </>
                        )}
                      </>
                    )
                  },
                }}
              </v-card-text>
              <v-card-actions>
                <v-btn block color="primary" variant="flat" size="large" loading={saving.value} onClick={save}>
                  Зберегти накладну
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </div>
    )
  },
})
