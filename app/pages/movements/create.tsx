interface MovementItemRow {
  productId: string
  quantity: number
  _product?: any
  _availableQty?: number
}

export default defineComponent({
  name: 'MovementCreatePage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const router = useRouter()
    const { data: warehousesData } = useFetch('/api/warehouses')
    const { data: objectsData } = useFetch('/api/objects')
    const { data: productsData } = useFetch('/api/products')

    const warehouses = computed(() => (warehousesData.value as any)?.warehouses ?? [])
    const objects = computed(() => (objectsData.value as any)?.objects?.filter((o: any) => o.status === 'ACTIVE') ?? [])
    const products = computed(() => (productsData.value as any)?.products ?? [])

    const form = reactive({
      type: 'WAREHOUSE_TO_WAREHOUSE',
      fromWarehouseId: '',
      toWarehouseId: '',
      objectId: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    })

    const items = ref<MovementItemRow[]>([])
    const saving = ref(false)
    const error = ref('')

    const typeOptions = [
      { title: 'Між складами', value: 'WAREHOUSE_TO_WAREHOUSE', icon: 'mdi-swap-horizontal' },
      { title: 'На будівельний обʼєкт', value: 'WAREHOUSE_TO_OBJECT', icon: 'mdi-truck-delivery' },
    ]

    const availableProducts = computed(() => {
      if (!form.fromWarehouseId) return []
      return products.value.map((p: any) => {
        const stock = (p.stock ?? []).find((s: any) => s.warehouseId === form.fromWarehouseId)
        return { ...p, availableQty: stock ? Number(stock.quantity) : 0 }
      }).filter((p: any) => p.availableQty > 0)
    })

    function addItem() {
      items.value.push({ productId: '', quantity: 1 })
    }

    function removeItem(index: number) {
      items.value.splice(index, 1)
    }

    function onProductChange(index: number, productId: string) {
      const product = availableProducts.value.find((p: any) => p.id === productId)
      items.value[index]._product = product
      items.value[index]._availableQty = product?.availableQty ?? 0
    }

    function onWarehouseChange() {
      items.value = []
    }

    async function save() {
      error.value = ''
      if (!form.fromWarehouseId || !form.date) {
        error.value = 'Заповніть всі обовʼязкові поля'
        return
      }
      if (form.type === 'WAREHOUSE_TO_WAREHOUSE' && !form.toWarehouseId) {
        error.value = 'Оберіть склад призначення'
        return
      }
      if (form.type === 'WAREHOUSE_TO_OBJECT' && !form.objectId) {
        error.value = 'Оберіть обʼєкт призначення'
        return
      }
      if (items.value.length === 0) {
        error.value = 'Додайте хоча б один товар'
        return
      }

      saving.value = true
      try {
        const result = await $fetch('/api/movements', {
          method: 'POST',
          body: {
            ...form,
            toWarehouseId: form.type === 'WAREHOUSE_TO_WAREHOUSE' ? form.toWarehouseId : null,
            objectId: form.type === 'WAREHOUSE_TO_OBJECT' ? form.objectId : null,
            items: items.value.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          },
        })
        await router.push(`/movements/${(result as any).movement.id}`)
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        saving.value = false
      }
    }

    return () => (
      <div>
        <div class="d-flex align-center mb-4">
          <v-btn icon="mdi-arrow-left" variant="text" to="/movements" class="mr-2" />
          <div class="text-h5 font-weight-bold">Нове переміщення</div>
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
                  <v-col cols={12}>
                    <v-btn-toggle v-model={form.type} rounded="lg" mandatory class="mb-4">
                      {typeOptions.map((opt) => (
                        <v-btn key={opt.value} value={opt.value} prepend-icon={opt.icon}>
                          {opt.title}
                        </v-btn>
                      ))}
                    </v-btn-toggle>
                  </v-col>
                </v-row>
                <v-row>
                  <v-col cols={12} md={6}>
                    <v-select
                      v-model={form.fromWarehouseId}
                      label="Склад відправлення *"
                      items={warehouses.value}
                      item-title="name"
                      item-value="id"
                      prepend-inner-icon="mdi-warehouse"
                      onChange={onWarehouseChange}
                    />
                  </v-col>
                  <v-col cols={12} md={6}>
                    {form.type === 'WAREHOUSE_TO_WAREHOUSE' ? (
                      <v-select
                        v-model={form.toWarehouseId}
                        label="Склад призначення *"
                        items={warehouses.value.filter((w: any) => w.id !== form.fromWarehouseId)}
                        item-title="name"
                        item-value="id"
                        prepend-inner-icon="mdi-warehouse"
                      />
                    ) : (
                      <v-select
                        v-model={form.objectId}
                        label="Будівельний обʼєкт *"
                        items={objects.value}
                        item-title="name"
                        item-value="id"
                        prepend-inner-icon="mdi-office-building-outline"
                      />
                    )}
                  </v-col>
                </v-row>
                <v-row>
                  <v-col cols={12} md={4}>
                    <v-text-field v-model={form.date} label="Дата *" type="date" />
                  </v-col>
                  <v-col cols={12} md={8}>
                    <v-text-field v-model={form.notes} label="Примітки" />
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>

            <v-card>
              <v-card-title class="d-flex align-center">
                Товари для переміщення
                <v-spacer />
                <v-btn
                  size="small"
                  color="primary"
                  prepend-icon="mdi-plus"
                  disabled={!form.fromWarehouseId}
                  onClick={addItem}
                >
                  Додати товар
                </v-btn>
              </v-card-title>
              <v-card-text>
                {!form.fromWarehouseId && (
                  <v-alert type="info" variant="tonal">Спочатку оберіть склад відправлення</v-alert>
                )}
                {form.fromWarehouseId && availableProducts.value.length === 0 && (
                  <v-alert type="warning" variant="tonal">На обраному складі немає товарів</v-alert>
                )}
                {items.value.map((item, index) => (
                  <v-row key={index} align="center" class="mb-2">
                    <v-col cols={12} md={6}>
                      <v-autocomplete
                        v-model={item.productId}
                        label="Товар *"
                        items={availableProducts.value}
                        item-title="name"
                        item-value="id"
                        hide-details
                        onChange={(val: string) => onProductChange(index, val)}
                      />
                    </v-col>
                    <v-col cols={12} md={4}>
                      <v-text-field
                        v-model={item.quantity}
                        label="Кількість *"
                        type="number"
                        min={0.001}
                        step={0.001}
                        hide-details
                        suffix={item._product?.unit || ''}
                        hint={item._availableQty !== undefined ? `Доступно: ${item._availableQty}` : ''}
                        persistent-hint
                      />
                    </v-col>
                    <v-col cols={12} md={2}>
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
                  <span class="text-medium-emphasis">Тип:</span>
                  <v-chip size="small" color={form.type === 'WAREHOUSE_TO_WAREHOUSE' ? 'primary' : 'warning'} variant="tonal">
                    {form.type === 'WAREHOUSE_TO_WAREHOUSE' ? 'Між складами' : 'На обʼєкт'}
                  </v-chip>
                </div>
              </v-card-text>
              <v-card-actions>
                <v-btn block color="primary" size="large" loading={saving.value} onClick={save}>
                  Зберегти переміщення
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </div>
    )
  },
})
