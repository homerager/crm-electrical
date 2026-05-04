import type { PropType } from 'vue'

export interface ObjectStockRow {
  productId: string
  quantity: unknown
  product: { name: string; sku?: string | null; unit: string }
}

interface LineRow {
  productId: string
  quantity: number
}

export default defineComponent({
  name: 'ObjectStockOps',
  props: {
    objectId: { type: String, required: true },
    stockRows: { type: Array as PropType<ObjectStockRow[]>, default: () => [] },
  },
  emits: {
    success: () => true,
  },
  setup(props, { emit }) {
    const { data: warehousesData } = useFetch('/api/warehouses')
    const warehouses = computed(
      () => (warehousesData.value as any)?.warehouses?.filter((w: any) => w.isActive !== false) ?? [],
    )

    const writeOffOpen = ref(false)
    const returnOpen = ref(false)
    const savingW = ref(false)
    const savingR = ref(false)
    const errW = ref('')
    const errR = ref('')

    const wForm = reactive({ date: '', notes: '' })
    const rForm = reactive({ date: '', notes: '', toWarehouseId: '' })

    const wItems = ref<LineRow[]>([])
    const rItems = ref<LineRow[]>([])

    const productOptions = computed(() =>
      props.stockRows.map((r) => ({
        id: r.productId,
        title: `${r.product.name}${r.product.sku ? ` · ${r.product.sku}` : ''}`,
        maxQty: Number(r.quantity),
        unit: r.product.unit,
      })),
    )

    function maxQtyFor(productId: string) {
      return productOptions.value.find((p) => p.id === productId)?.maxQty ?? 0
    }

    function unitFor(productId: string) {
      return productOptions.value.find((p) => p.id === productId)?.unit ?? ''
    }

    function openWriteOff() {
      errW.value = ''
      wForm.date = new Date().toISOString().split('T')[0]
      wForm.notes = ''
      const first = props.stockRows[0]
      wItems.value = first ? [{ productId: first.productId, quantity: 1 }] : [{ productId: '', quantity: 1 }]
      writeOffOpen.value = true
    }

    function openReturn() {
      errR.value = ''
      rForm.date = new Date().toISOString().split('T')[0]
      rForm.notes = ''
      rForm.toWarehouseId = warehouses.value[0]?.id ?? ''
      const first = props.stockRows[0]
      rItems.value = first ? [{ productId: first.productId, quantity: 1 }] : [{ productId: '', quantity: 1 }]
      returnOpen.value = true
    }

    function addWLine() {
      wItems.value.push({ productId: '', quantity: 1 })
    }

    function addRLine() {
      rItems.value.push({ productId: '', quantity: 1 })
    }

    function removeW(i: number) {
      wItems.value.splice(i, 1)
    }

    function removeR(i: number) {
      rItems.value.splice(i, 1)
    }

    async function submitWriteOff() {
      errW.value = ''
      const items = wItems.value
        .filter((l) => l.productId)
        .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }))
      if (items.length === 0) {
        errW.value = 'Додайте хоча б один товар'
        return
      }
      for (const l of items) {
        if (!Number.isFinite(l.quantity) || l.quantity <= 0) {
          errW.value = 'Перевірте кількість у рядках'
          return
        }
        const max = maxQtyFor(l.productId)
        if (l.quantity > max + 1e-9) {
          errW.value = `Кількість перевищує залишок на обʼєкті для одного з товарів (макс. ${max})`
          return
        }
      }
      savingW.value = true
      try {
        await $fetch('/api/movements', {
          method: 'POST',
          body: {
            type: 'OBJECT_WRITE_OFF',
            objectId: props.objectId,
            date: wForm.date,
            notes: wForm.notes || null,
            items,
          },
        })
        writeOffOpen.value = false
        emit('success')
      } catch (e: any) {
        errW.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        savingW.value = false
      }
    }

    async function submitReturn() {
      errR.value = ''
      if (!rForm.toWarehouseId) {
        errR.value = 'Оберіть склад'
        return
      }
      const items = rItems.value
        .filter((l) => l.productId)
        .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }))
      if (items.length === 0) {
        errR.value = 'Додайте хоча б один товар'
        return
      }
      for (const l of items) {
        if (!Number.isFinite(l.quantity) || l.quantity <= 0) {
          errR.value = 'Перевірте кількість у рядках'
          return
        }
        const max = maxQtyFor(l.productId)
        if (l.quantity > max + 1e-9) {
          errR.value = `Кількість перевищує залишок на обʼєкті (макс. ${max})`
          return
        }
      }
      savingR.value = true
      try {
        await $fetch('/api/movements', {
          method: 'POST',
          body: {
            type: 'OBJECT_TO_WAREHOUSE',
            objectId: props.objectId,
            toWarehouseId: rForm.toWarehouseId,
            date: rForm.date,
            notes: rForm.notes || null,
            items,
          },
        })
        returnOpen.value = false
        emit('success')
      } catch (e: any) {
        errR.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        savingR.value = false
      }
    }

    const hasStock = computed(() => props.stockRows.some((r) => Number(r.quantity) > 0))

    return () => (
      <div class="d-flex flex-wrap gap-2 mb-2 pl-4">
        <v-btn
          color="error"
          variant="tonal"
          prepend-icon="mdi-minus-circle-outline"
          disabled={!hasStock.value}
          onClick={openWriteOff}
        >
          Списати з обʼєкта
        </v-btn>
        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-warehouse"
          disabled={!hasStock.value}
          onClick={openReturn}
        >
          Повернути на склад
        </v-btn>

        <v-dialog v-model={writeOffOpen.value} max-width={560}>
          <v-card>
            <v-card-title>Списання матеріалів</v-card-title>
            <v-card-text>
              {errW.value && (
                <v-alert type="error" variant="tonal" class="mb-3">
                  {errW.value}
                </v-alert>
              )}
              <p class="text-body-2 text-medium-emphasis mb-3">
                Фактично використана кількість знімається з залишку на обʼєкті й не повертається на склад.
              </p>
              <v-text-field v-model={wForm.date} label="Дата *" type="date" class="mb-2" disabled={savingW.value} />
              <v-text-field v-model={wForm.notes} label="Примітки" class="mb-2" disabled={savingW.value} />
              {wItems.value.map((line, index) => (
                <div key={index} class="mb-3">
                  <v-row align="center">
                    <v-col cols={12} md={6}>
                      <v-select
                        v-model={line.productId}
                        label="Товар *"
                        items={productOptions.value}
                        item-title="title"
                        item-value="id"
                        hide-details
                        disabled={savingW.value}
                      />
                    </v-col>
                    <v-col cols={12} md={4}>
                      <v-text-field
                        v-model={line.quantity}
                        label="Кількість *"
                        type="number"
                        min={0.001}
                        step={0.001}
                        suffix={line.productId ? unitFor(line.productId) : ''}
                        hide-details
                        disabled={savingW.value}
                      />
                    </v-col>
                    <v-col cols="auto" class="d-flex align-center justify-md-center pt-3 pt-md-0">
                      <v-btn
                        icon="mdi-delete"
                        variant="text"
                        size="small"
                        disabled={savingW.value || wItems.value.length <= 1}
                        onClick={() => removeW(index)}
                      />
                    </v-col>
                  </v-row>
                  {line.productId ? (
                    <div class="text-caption text-medium-emphasis mt-n2 ms-md-1">
                      На обʼєкті: {maxQtyFor(line.productId)} {unitFor(line.productId)}
                    </div>
                  ) : null}
                </div>
              ))}
              <v-btn
                size="small"
                variant="text"
                prepend-icon="mdi-plus"
                class="mt-2"
                disabled={savingW.value}
                onClick={addWLine}
              >
                Додати рядок
              </v-btn>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" disabled={savingW.value} onClick={() => (writeOffOpen.value = false)}>
                Скасувати
              </v-btn>
              <v-btn color="error" variant="flat" loading={savingW.value} onClick={submitWriteOff}>
                Списати
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model={returnOpen.value} max-width={560}>
          <v-card>
            <v-card-title>Повернення на склад</v-card-title>
            <v-card-text>
              {errR.value && (
                <v-alert type="error" variant="tonal" class="mb-3">
                  {errR.value}
                </v-alert>
              )}
              <v-select
                v-model={rForm.toWarehouseId}
                label="Склад призначення *"
                items={warehouses.value}
                item-title="name"
                item-value="id"
                class="mb-3"
                prepend-inner-icon="mdi-warehouse"
                disabled={savingR.value}
              />
              <v-text-field v-model={rForm.date} label="Дата *" type="date" class="mb-2" disabled={savingR.value} />
              <v-text-field v-model={rForm.notes} label="Примітки" class="mb-2" disabled={savingR.value} />
              {rItems.value.map((line, index) => (
                <div key={index} class="mb-3">
                  <v-row align="center">
                    <v-col cols={12} md={6}>
                      <v-select
                        v-model={line.productId}
                        label="Товар *"
                        items={productOptions.value}
                        item-title="title"
                        item-value="id"
                        hide-details
                        disabled={savingR.value}
                      />
                    </v-col>
                    <v-col cols={12} md={4}>
                      <v-text-field
                        v-model={line.quantity}
                        label="Кількість *"
                        type="number"
                        min={0.001}
                        step={0.001}
                        suffix={line.productId ? unitFor(line.productId) : ''}
                        hide-details
                        disabled={savingR.value}
                      />
                    </v-col>
                    <v-col cols="auto" class="d-flex align-center justify-md-center pt-3 pt-md-0">
                      <v-btn
                        icon="mdi-delete"
                        variant="text"
                        size="small"
                        disabled={savingR.value || rItems.value.length <= 1}
                        onClick={() => removeR(index)}
                      />
                    </v-col>
                  </v-row>
                  {line.productId ? (
                    <div class="text-caption text-medium-emphasis mt-n2 ms-md-1">
                      На обʼєкті: {maxQtyFor(line.productId)} {unitFor(line.productId)}
                    </div>
                  ) : null}
                </div>
              ))}
              <v-btn
                size="small"
                variant="text"
                prepend-icon="mdi-plus"
                class="mt-2"
                disabled={savingR.value}
                onClick={addRLine}
              >
                Додати рядок
              </v-btn>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" disabled={savingR.value} onClick={() => (returnOpen.value = false)}>
                Скасувати
              </v-btn>
              <v-btn color="primary" variant="flat" loading={savingR.value} onClick={submitReturn}>
                Повернути
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
