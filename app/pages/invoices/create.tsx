interface InvoiceItemRow {
  productId: string
  quantity: number
  pricePerUnit: number
  _product?: any
}

export default defineComponent({
  name: 'InvoiceCreatePage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({
      title: 'Нова накладна'
    })

    const router = useRouter()
    const { data: warehousesData } = useFetch('/api/warehouses')
    const { data: contractorsData } = useFetch('/api/contractors')
    const { data: productsData } = useFetch('/api/products')

    const warehouses = computed(() => (warehousesData.value as any)?.warehouses ?? [])
    const contractors = computed(() => (contractorsData.value as any)?.contractors ?? [])
    const products = computed(() => (productsData.value as any)?.products ?? [])

    const form = reactive({
      number: '',
      type: 'INCOMING',
      warehouseId: '',
      contractorId: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    })

    const items = ref<InvoiceItemRow[]>([])
    const saving = ref(false)
    const error = ref('')

    const typeOptions = [
      { title: 'Прихід', value: 'INCOMING' },
      { title: 'Видаток', value: 'OUTGOING' },
    ]

    function addItem() {
      items.value.push({ productId: '', quantity: 1, pricePerUnit: 0 })
    }

    function removeItem(index: number) {
      items.value.splice(index, 1)
    }

    function onProductChange(index: number, productId: string) {
      const product = products.value.find((p: any) => p.id === productId)
      items.value[index]._product = product
    }

    async function save() {
      error.value = ''
      if (!form.number || !form.warehouseId || !form.date) {
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
        const result = await $fetch('/api/invoices', {
          method: 'POST',
          body: { ...form, items: items.value.map((i) => ({ productId: i.productId, quantity: i.quantity, pricePerUnit: i.pricePerUnit })) },
        })
        await router.push(`/invoices/${(result as any).invoice.id}`)
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        saving.value = false
      }
    }

    return () => (
      <div>
        <div class="d-flex align-center mb-4">
          <v-btn icon="mdi-arrow-left" variant="text" to="/invoices" class="mr-2" />
          <div class="text-h5 font-weight-bold">Нова накладна</div>
        </div>

        {error.value && (
          <v-alert type="error" variant="tonal" class="mb-4" closable onUpdate:modelValue={() => (error.value = '')}>
            {error.value}
          </v-alert>
        )}

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
                  <v-col cols={12} md={6}>
                    <v-select
                      v-model={form.warehouseId}
                      label="Склад *"
                      items={warehouses.value}
                      item-title="name"
                      item-value="id"
                    />
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
                    <v-col cols={12} md={5}>
                      <v-autocomplete
                        v-model={item.productId}
                        label="Товар *"
                        items={products.value}
                        item-title="name"
                        item-value="id"
                        hide-details
                        onChange={(val: string) => onProductChange(index, val)}
                      />
                    </v-col>
                    <v-col cols={12} md={3}>
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
                    <v-col cols={12} md={3}>
                      <v-text-field
                        v-model={item.pricePerUnit}
                        label="Ціна за од."
                        type="number"
                        min={0}
                        step={0.01}
                        hide-details
                        prefix="₴"
                      />
                    </v-col>
                    <v-col cols={12} md={1}>
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
                <div class="d-flex justify-space-between mb-2">
                  <span class="text-medium-emphasis">Позицій:</span>
                  <strong>{items.value.length}</strong>
                </div>
                <div class="d-flex justify-space-between mb-2">
                  <span class="text-medium-emphasis">Сума:</span>
                  <strong>
                    ₴{items.value.reduce((s, i) => s + i.quantity * i.pricePerUnit, 0).toLocaleString('uk-UA', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
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
