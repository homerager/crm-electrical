export interface MovementItemRow {
  productId: string
  quantity: number
  _product?: any
  _availableQty?: number
}

export type MovementEditorLayout = 'page' | 'dialog'

export default defineComponent({
  name: 'MovementEditor',
  props: {
    layout: {
      type: String as PropType<MovementEditorLayout>,
      default: 'page' satisfies MovementEditorLayout,
    },
    readRouteQuery: { type: Boolean, default: false },
    fixedFromWarehouseId: { type: String, default: '' },
    lockFromWarehouse: { type: Boolean, default: false },
    initialProductId: { type: String, default: '' },
    initialQty: { type: Number, default: undefined },
  },
  emits: {
    success: (movementId: string) => true,
    cancel: () => true,
  },
  setup(props, { emit }) {
    const router = useRouter()
    const route = useRoute()
    const { data: warehousesData } = useFetch('/api/warehouses')
    const { data: objectsData } = useFetch('/api/objects')
    const { data: productsData } = useFetch('/api/products')

    const warehouses = computed(() => (warehousesData.value as any)?.warehouses ?? [])
    const objects = computed(
      () => (objectsData.value as any)?.objects?.filter((o: any) => o.status === 'ACTIVE') ?? [],
    )
    const products = computed(() => (productsData.value as any)?.products ?? [])

    const form = reactive({
      type: 'WAREHOUSE_TO_WAREHOUSE' as 'WAREHOUSE_TO_WAREHOUSE' | 'WAREHOUSE_TO_OBJECT',
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
      { title: 'Між складами', value: 'WAREHOUSE_TO_WAREHOUSE' as const, icon: 'mdi-swap-horizontal' },
      { title: 'На будівельний обʼєкт', value: 'WAREHOUSE_TO_OBJECT' as const, icon: 'mdi-truck-delivery' },
    ]

    const availableProducts = computed(() => {
      if (!form.fromWarehouseId) return []
      return products.value
        .map((p: any) => {
          const stock = (p.stock ?? []).find((s: any) => s.warehouseId === form.fromWarehouseId)
          return { ...p, availableQty: stock ? Number(stock.quantity) : 0 }
        })
        .filter((p: any) => p.availableQty > 0)
    })

    const fromWarehouseName = computed(
      () => warehouses.value.find((w: any) => w.id === form.fromWarehouseId)?.name ?? '',
    )

    function addItem() {
      items.value.push({ productId: '', quantity: 1 })
    }

    function removeItem(index: number) {
      items.value.splice(index, 1)
    }

    function onProductChange(index: number, productId: string) {
      const product = availableProducts.value.find((p: any) => p.id === productId)
      const row = items.value[index]
      if (row) {
        row._product = product
        row._availableQty = product?.availableQty ?? 0
      }
    }

    const productQueryApplied = ref(false)
    const initialLineApplied = ref(false)

    function onWarehouseChange() {
      items.value = []
      if (props.readRouteQuery && route.query.product) {
        productQueryApplied.value = false
      }
      if (!props.lockFromWarehouse) {
        initialLineApplied.value = false
      }
    }

    watch(
      () => [props.fixedFromWarehouseId, warehousesData.value] as const,
      () => {
        if (!props.fixedFromWarehouseId) return
        const list = (warehousesData.value as any)?.warehouses ?? []
        if (list.some((w: any) => w.id === props.fixedFromWarehouseId)) {
          form.fromWarehouseId = props.fixedFromWarehouseId
        }
      },
      { immediate: true },
    )

    const fromQueryApplied = ref(false)
    watch(
      () => [props.readRouteQuery, route.query.from, warehousesData.value] as const,
      () => {
        if (!props.readRouteQuery) return
        if (fromQueryApplied.value) return
        const q = route.query.from
        const wid = Array.isArray(q) ? q[0] : q
        if (typeof wid !== 'string' || !wid) return
        const list = (warehousesData.value as any)?.warehouses ?? []
        if (list.some((w: any) => w.id === wid)) {
          form.fromWarehouseId = wid
          fromQueryApplied.value = true
        }
      },
      { immediate: true },
    )

    watch(
      () =>
        [
          props.readRouteQuery,
          route.query.product,
          route.query.qty,
          form.fromWarehouseId,
          productsData.value,
          productQueryApplied.value,
        ] as const,
      () => {
        if (!props.readRouteQuery) return
        if (productQueryApplied.value) return
        const pq = route.query.product
        const productId = Array.isArray(pq) ? pq[0] : pq
        if (typeof productId !== 'string' || !productId) return
        if (!form.fromWarehouseId) return
        const rawList = (productsData.value as any)?.products
        if (!rawList) return
        const p = rawList.find((x: any) => x.id === productId)
        if (!p) {
          productQueryApplied.value = true
          return
        }
        const stock = (p.stock ?? []).find((s: any) => s.warehouseId === form.fromWarehouseId)
        const availableQty = stock ? Number(stock.quantity) : 0
        if (availableQty <= 0) {
          productQueryApplied.value = true
          return
        }
        const qq = route.query.qty
        const qtyStr = Array.isArray(qq) ? qq[0] : qq
        let qty: number
        if (typeof qtyStr === 'string' && qtyStr !== '') {
          const n = Number(qtyStr)
          qty = Number.isFinite(n) && n > 0 ? n : availableQty
        } else {
          qty = availableQty
        }
        qty = Math.min(qty, availableQty)
        const enriched = { ...p, availableQty }
        items.value = [
          {
            productId,
            quantity: qty,
            _product: enriched,
            _availableQty: availableQty,
          },
        ]
        productQueryApplied.value = true
      },
      { immediate: true },
    )

    watch(
      () =>
        [
          props.readRouteQuery,
          props.initialProductId,
          props.initialQty,
          form.fromWarehouseId,
          productsData.value,
          initialLineApplied.value,
        ] as const,
      () => {
        if (props.readRouteQuery) return
        if (initialLineApplied.value) return
        const productId = props.initialProductId
        if (typeof productId !== 'string' || !productId) return
        if (!form.fromWarehouseId) return
        const rawList = (productsData.value as any)?.products
        if (!rawList) return
        const p = rawList.find((x: any) => x.id === productId)
        if (!p) {
          initialLineApplied.value = true
          return
        }
        const stock = (p.stock ?? []).find((s: any) => s.warehouseId === form.fromWarehouseId)
        const availableQty = stock ? Number(stock.quantity) : 0
        if (availableQty <= 0) {
          initialLineApplied.value = true
          return
        }
        let qty = availableQty
        if (props.initialQty !== undefined && Number.isFinite(props.initialQty) && props.initialQty > 0) {
          qty = Math.min(props.initialQty, availableQty)
        }
        const enriched = { ...p, availableQty }
        items.value = [
          {
            productId,
            quantity: qty,
            _product: enriched,
            _availableQty: availableQty,
          },
        ]
        initialLineApplied.value = true
      },
      { immediate: true },
    )

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
        const movementId = (result as any).movement.id
        emit('success', movementId)
        if (props.layout === 'page') {
          await router.push(`/movements/${movementId}`)
        }
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        saving.value = false
      }
    }

    const isDialog = computed(() => props.layout === 'dialog')
    const mainCols = computed(() => (isDialog.value ? 12 : 8))
    const sideCols = computed(() => (isDialog.value ? 12 : 4))

    return () => (
      <v-row>
        {error.value && !isDialog.value && (
          <v-col cols={12}>
            <v-alert
              type="error"
              variant="tonal"
              class="mb-4"
              closable
              onUpdate:modelValue={() => (error.value = '')}
            >
              {error.value}
            </v-alert>
          </v-col>
        )}
        {error.value && isDialog.value && (
          <v-col cols={12}>
            <v-alert
              type="error"
              variant="tonal"
              class="mb-2"
              closable
              onUpdate:modelValue={() => (error.value = '')}
            >
              {error.value}
            </v-alert>
          </v-col>
        )}

        <v-col cols={12} md={mainCols.value}>
          <v-card class="mb-4">
            <v-card-title>Основні дані</v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols={12}>
                  <v-btn-toggle v-model={form.type} rounded="lg" mandatory class="mb-4" disabled={saving.value}>
                    {typeOptions.map((opt) => (
                      <v-btn key={opt.value} value={opt.value} prepend-icon={opt.icon} size="small">
                        {opt.title}
                      </v-btn>
                    ))}
                  </v-btn-toggle>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols={12} md={6}>
                  {props.lockFromWarehouse && props.fixedFromWarehouseId ? (
                    <v-text-field
                      modelValue={fromWarehouseName.value}
                      label="Склад відправлення *"
                      readonly
                      disabled={saving.value}
                      prepend-inner-icon="mdi-warehouse"
                    />
                  ) : (
                    <v-select
                      v-model={form.fromWarehouseId}
                      label="Склад відправлення *"
                      items={warehouses.value}
                      item-title="name"
                      item-value="id"
                      prepend-inner-icon="mdi-warehouse"
                      onChange={onWarehouseChange}
                      disabled={saving.value}
                    />
                  )}
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
                      disabled={saving.value}
                    />
                  ) : (
                    <v-select
                      v-model={form.objectId}
                      label="Будівельний обʼєкт *"
                      items={objects.value}
                      item-title="name"
                      item-value="id"
                      prepend-inner-icon="mdi-office-building-outline"
                      disabled={saving.value}
                    />
                  )}
                </v-col>
              </v-row>
              <v-row>
                <v-col cols={12} md={4}>
                  <v-text-field v-model={form.date} label="Дата *" type="date" disabled={saving.value} />
                </v-col>
                <v-col cols={12} md={8}>
                  <v-text-field v-model={form.notes} label="Примітки" disabled={saving.value} />
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
                disabled={!form.fromWarehouseId || saving.value}
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
                      disabled={saving.value}
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
                      disabled={saving.value}
                    />
                  </v-col>
                  <v-col cols={12} md={2}>
                    <v-btn
                      icon="mdi-delete"
                      variant="text"
                      color="error"
                      size="small"
                      disabled={saving.value}
                      onClick={() => removeItem(index)}
                    />
                  </v-col>
                </v-row>
              ))}
            </v-card-text>
            {isDialog.value && (
              <v-card-actions class="d-flex flex-wrap justify-end gap-2 px-4 pb-4">
                <v-btn variant="text" disabled={saving.value} onClick={() => emit('cancel')}>
                  Скасувати
                </v-btn>
                <v-btn color="primary" variant="flat" loading={saving.value} onClick={save}>
                  Зберегти
                </v-btn>
              </v-card-actions>
            )}
          </v-card>
        </v-col>

        {!isDialog.value && (
          <v-col cols={12} md={sideCols.value}>
            <v-card>
              <v-card-title>Підсумок</v-card-title>
              <v-card-text>
                <div class="d-flex justify-space-between mb-2">
                  <span class="text-medium-emphasis">Позицій:</span>
                  <strong>{items.value.length}</strong>
                </div>
                <div class="d-flex justify-space-between mb-2">
                  <span class="text-medium-emphasis">Тип:</span>
                  <v-chip
                    size="small"
                    color={form.type === 'WAREHOUSE_TO_WAREHOUSE' ? 'primary' : 'warning'}
                    variant="tonal"
                  >
                    {form.type === 'WAREHOUSE_TO_WAREHOUSE' ? 'Між складами' : 'На обʼєкт'}
                  </v-chip>
                </div>
              </v-card-text>
              <v-card-actions>
                <v-btn
                  block
                  color="primary"
                  variant="flat"
                  size="large"
                  loading={saving.value}
                  onClick={save}
                >
                  Зберегти переміщення
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        )}
      </v-row>
    )
  },
})
