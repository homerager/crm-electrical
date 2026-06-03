export interface MovementItemRow {
  productId: string
  /** Exact lot the line moves — supplier + unit price (+ vat attribute, not part of the merge key). */
  contractorId: string | null
  pricePerUnit: number
  vatPercent: number
  quantity: number
  _product?: any
  /** Stable key identifying the chosen lot in the dropdown: `${contractorId}|${price}`. */
  _lotKey?: string
  _availableQty?: number
}

interface AvailableLot {
  key: string
  contractorId: string | null
  pricePerUnit: number
  vatPercent: number
  contractorName: string
  available: number
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
    const toast = useToast()
    const { data: warehousesData } = useFetch('/api/warehouses')
    const { data: objectsData } = useFetch('/api/objects')

    const warehouses = computed(() => (warehousesData.value as any)?.warehouses ?? [])
    const objects = computed(
      () => (objectsData.value as any)?.objects?.filter((o: any) => o.status === 'ACTIVE') ?? [],
    )

    const form = reactive({
      type: 'WAREHOUSE_TO_WAREHOUSE' as 'WAREHOUSE_TO_WAREHOUSE' | 'WAREHOUSE_TO_OBJECT',
      fromWarehouseId: '',
      toWarehouseId: '',
      objectId: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    })

    const { data: productsData } = useFetch(() => {
      if (form.type === 'WAREHOUSE_TO_OBJECT' && form.objectId) {
        return `/api/products?forObjectId=${encodeURIComponent(form.objectId)}`
      }
      return '/api/products'
    })

    const products = computed(() => (productsData.value as any)?.products ?? [])

    const items = ref<MovementItemRow[]>([])
    const saving = ref(false)
    const error = ref('')

    function maxMovableQty(stock: any | undefined): number {
      if (!stock) return 0
      const rawFree = stock.freeOnWarehouse ?? stock.quantity
      const free = Number(rawFree)
      if (!Number.isFinite(free) || free < 0) return 0
      if (form.type === 'WAREHOUSE_TO_WAREHOUSE') return free
      if (form.type === 'WAREHOUSE_TO_OBJECT' && form.objectId) {
        const capRaw = stock.maxMovableToSelectedObject
        if (capRaw !== undefined && capRaw !== null) {
          const cap = Number(capRaw)
          if (Number.isFinite(cap)) return cap
        }
        return free
      }
      return free
    }

    function lotKeyOf(contractorId: string | null, price: number | string): string {
      return `${contractorId ?? ''}|${Number(price).toFixed(2)}`
    }

    /** Available lots for a product on the from-warehouse, oldest-first (the API orders stock by id). */
    function lotsForProductId(productId: string): AvailableLot[] {
      if (!productId || !form.fromWarehouseId) return []
      if (form.type === 'WAREHOUSE_TO_OBJECT' && !form.objectId) return []
      const p = products.value.find((x: any) => x.id === productId)
      if (!p) return []
      return (p.stock ?? [])
        .filter((s: any) => s.warehouseId === form.fromWarehouseId)
        .map((s: any): AvailableLot => {
          const contractorId = s.contractorId ?? null
          const pricePerUnit = Number(s.pricePerUnit)
          return {
            key: lotKeyOf(contractorId, pricePerUnit),
            contractorId,
            pricePerUnit,
            vatPercent: Number(s.vatPercent),
            contractorName: s.contractor?.name ?? '',
            available: maxMovableQty(s),
          }
        })
        .filter((l: AvailableLot) => l.available > 0)
    }

    /** Dropdown items describing each lot as `supplier · ціна · доступно`. */
    function lotOptions(productId: string, unit: string) {
      return lotsForProductId(productId).map((l) => ({
        ...l,
        title: `${l.contractorName || 'Без постачальника'} · ₴${l.pricePerUnit.toFixed(2)} · ${l.available.toLocaleString('uk-UA')}${unit ? ` ${unit}` : ''}`,
      }))
    }

    function applyLotToRow(row: MovementItemRow, lot: AvailableLot) {
      row.contractorId = lot.contractorId
      row.pricePerUnit = lot.pricePerUnit
      row.vatPercent = lot.vatPercent
      row._lotKey = lot.key
      row._availableQty = lot.available
    }

    function clearLotOnRow(row: MovementItemRow) {
      row.contractorId = null
      row.pricePerUnit = 0
      row.vatPercent = 0
      row._lotKey = ''
      row._availableQty = 0
    }

    /** Max movable quantity for the lot currently selected on a row. */
    function maxQtyForRow(row: MovementItemRow): number {
      if (!row._lotKey) return 0
      const lot = lotsForProductId(row.productId).find((l) => l.key === row._lotKey)
      return lot?.available ?? 0
    }

    function onLotChange(index: number, key: string) {
      const row = items.value[index]
      if (!row) return
      const lot = lotsForProductId(row.productId).find((l) => l.key === key)
      if (!lot) {
        clearLotOnRow(row)
        return
      }
      applyLotToRow(row, lot)
      if (Number(row.quantity) > lot.available) row.quantity = lot.available
    }

    function refreshRowAvailability(index: number) {
      const row = items.value[index]
      if (!row?.productId) return
      row._product = products.value.find((x: any) => x.id === row.productId)
      const lots = lotsForProductId(row.productId)
      if (!row._lotKey) {
        // Auto-select when only one lot exists; otherwise leave the choice to the user.
        if (lots.length === 1 && lots[0]) applyLotToRow(row, lots[0])
        return
      }
      const lot = lots.find((l) => l.key === row._lotKey)
      if (lot) {
        row.vatPercent = lot.vatPercent
        row._availableQty = lot.available
      } else {
        clearLotOnRow(row)
        if (lots.length === 1 && lots[0]) applyLotToRow(row, lots[0])
      }
    }

    const typeOptions = [
      { title: 'Між складами', value: 'WAREHOUSE_TO_WAREHOUSE' as const, icon: 'mdi-swap-horizontal' },
      { title: 'На будівельний обʼєкт', value: 'WAREHOUSE_TO_OBJECT' as const, icon: 'mdi-truck-delivery' },
    ]

    const availableProducts = computed(() => {
      if (!form.fromWarehouseId) return []
      if (form.type === 'WAREHOUSE_TO_OBJECT' && !form.objectId) return []
      return products.value
        .map((p: any) => {
          // A product can have several lots on the same warehouse; the total movable is their sum.
          const availableQty = (p.stock ?? [])
            .filter((s: any) => s.warehouseId === form.fromWarehouseId)
            .reduce((sum: number, s: any) => sum + maxMovableQty(s), 0)
          return { ...p, availableQty }
        })
        .filter((p: any) => p.availableQty > 0)
    })

    const fromWarehouseName = computed(
      () => warehouses.value.find((w: any) => w.id === form.fromWarehouseId)?.name ?? '',
    )

    function addItem() {
      items.value.push({ productId: '', contractorId: null, pricePerUnit: 0, vatPercent: 0, quantity: 1 })
    }

    function removeItem(index: number) {
      items.value.splice(index, 1)
    }

    function onProductChange(index: number) {
      const row = items.value[index]
      if (!row) return
      clearLotOnRow(row)
      refreshRowAvailability(index)
    }

    /**
     * Builds a single pre-filled line for the "inject product + qty" flows (low-stock quick move,
     * purchase request). Auto-selects the first (oldest) available lot; returns null if none exist.
     */
    function buildInjectedRow(productId: string, requestedQty?: number): MovementItemRow | null {
      const p = products.value.find((x: any) => x.id === productId)
      if (!p) return null
      const lots = lotsForProductId(productId)
      const firstLot = lots[0]
      if (!firstLot) return null
      const row: MovementItemRow = {
        productId,
        contractorId: null,
        pricePerUnit: 0,
        vatPercent: 0,
        quantity: 1,
        _product: p,
        _lotKey: '',
        _availableQty: 0,
      }
      applyLotToRow(row, firstLot)
      const available = row._availableQty ?? 0
      let qty = available
      if (requestedQty !== undefined && Number.isFinite(requestedQty) && requestedQty > 0) {
        qty = Math.min(requestedQty, available)
      }
      row.quantity = qty
      return row
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
        if (!(productsData.value as any)?.products) return
        const qq = route.query.qty
        const qtyStr = Array.isArray(qq) ? qq[0] : qq
        const requested = typeof qtyStr === 'string' && qtyStr !== '' ? Number(qtyStr) : undefined
        const row = buildInjectedRow(productId, requested)
        if (row) items.value = [row]
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
        if (!(productsData.value as any)?.products) return
        const row = buildInjectedRow(productId, props.initialQty)
        if (row) items.value = [row]
        initialLineApplied.value = true
      },
      { immediate: true },
    )

    watch(
      () => [form.type, form.objectId, form.fromWarehouseId, productsData.value] as const,
      () => {
        const raw = (productsData.value as any)?.products
        if (!Array.isArray(raw) || raw.length === 0) return
        items.value.forEach((row, index) => {
          if (row.productId) refreshRowAvailability(index)
        })
      },
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
      for (const row of items.value) {
        if (!row.productId) {
          error.value = 'Оберіть товар у кожному рядку'
          return
        }
        if (!row._lotKey) {
          error.value = 'Оберіть партію (постачальник · ціна) у кожному рядку'
          return
        }
        const q = Number(row.quantity)
        if (!Number.isFinite(q) || q <= 0) {
          error.value = 'Перевірте кількість у рядках'
          return
        }
        const max = maxQtyForRow(row)
        if (q > max + 1e-9) {
          error.value = `Кількість перевищує доступну для однієї з партій (макс. ${max})`
          return
        }
      }

      saving.value = true
      try {
        const result = await $fetch('/api/movements', {
          method: 'POST',
          body: {
            ...form,
            toWarehouseId: form.type === 'WAREHOUSE_TO_WAREHOUSE' ? form.toWarehouseId : null,
            objectId: form.type === 'WAREHOUSE_TO_OBJECT' ? form.objectId : null,
            items: items.value.map((i) => ({
              productId: i.productId,
              contractorId: i.contractorId,
              pricePerUnit: i.pricePerUnit,
              vatPercent: i.vatPercent,
              quantity: i.quantity,
            })),
          },
        })
        const movementId = (result as any).movement.id
        toast.success('Переміщення створено')
        emit('success', movementId)
        if (props.layout === 'page') {
          await router.push(`/movements/${movementId}`)
        }
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
        toast.error(error.value)
      } finally {
        saving.value = false
      }
    }

    const isDialog = computed(() => props.layout === 'dialog')
    const mainCols = computed(() => (isDialog.value ? 12 : 8))
    const sideCols = computed(() => (isDialog.value ? 12 : 4))

    return () => (
      <div class="movement-editor">
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
        </v-row>
        <v-row>
          <v-col cols={12} md={mainCols.value}>
            <v-card class="mb-4">
              <v-card-title>Основні дані</v-card-title>
              <v-card-text>
                <v-row>
                  <v-col cols={12}>
                    <v-btn-toggle v-model={form.type} rounded="lg" mandatory class="mb-4 gap-3" disabled={saving.value}>
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
                {form.type === 'WAREHOUSE_TO_OBJECT' && !form.objectId && form.fromWarehouseId && (
                  <v-alert type="info" variant="tonal" class="mb-2">
                    Оберіть будівельний обʼєкт, щоб показати доступні кількості з урахуванням резервів під обʼєкти.
                  </v-alert>
                )}
                {form.fromWarehouseId && availableProducts.value.length === 0 && (
                  <v-alert type="warning" variant="tonal">На обраному складі немає товарів</v-alert>
                )}
                {items.value.map((item, index) => (
                  <v-row key={index} align="start" class="mb-2">
                    <v-col cols={12} md={5}>
                      <v-autocomplete
                        modelValue={item.productId}
                        onUpdate:modelValue={(val: string) => {
                          item.productId = val
                          onProductChange(index)
                        }}
                        label="Товар *"
                        items={availableProducts.value}
                        item-title="name"
                        item-value="id"
                        hide-details
                        disabled={saving.value}
                      />
                    </v-col>
                    <v-col cols={12} md={4}>
                      <v-select
                        modelValue={item._lotKey ?? ''}
                        onUpdate:modelValue={(val: string) => onLotChange(index, val)}
                        label="Партія (постачальник · ціна) *"
                        items={lotOptions(item.productId, item._product?.unit || '')}
                        item-title="title"
                        item-value="key"
                        hide-details
                        disabled={saving.value || !item.productId}
                        no-data-text="Немає доступних партій"
                      />
                    </v-col>
                    <v-col cols={8} md={2}>
                      <v-text-field
                        v-model={item.quantity}
                        label="Кількість *"
                        type="number"
                        min={0.001}
                        step={0.001}
                        hide-details
                        suffix={item._product?.unit || ''}
                        hint={item._lotKey ? `Доступно: ${item._availableQty ?? 0}` : ''}
                        persistent-hint
                        disabled={saving.value || !item._lotKey}
                      />
                    </v-col>
                    <v-col cols={4} md={1}>
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
      </div>
    )
  },
})
