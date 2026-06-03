import type { PropType } from 'vue'

export interface ObjectStockRow {
  productId: string
  contractorId?: string | null
  pricePerUnit?: unknown
  vatPercent?: unknown
  quantity: unknown
  product: { name: string; sku?: string | null; unit: string }
  contractor?: { id: string; name: string } | null
}

interface LineRow {
  /** Selected object lot key: `${productId}|${contractorId}|${price}`. */
  lotKey: string
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
    const toast = useToast()
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

    // Each option is a specific object lot (product + supplier + price), so write-offs and
    // returns operate on the exact cost lot the user picks.
    const lotOptions = computed(() =>
      props.stockRows
        .filter((r) => Number(r.quantity) > 0)
        .map((r) => {
          const contractorId = r.contractorId ?? null
          const pricePerUnit = Number(r.pricePerUnit ?? 0)
          const supplier = r.contractor?.name || 'Без постачальника'
          return {
            key: `${r.productId}|${contractorId ?? ''}|${pricePerUnit.toFixed(2)}`,
            productId: r.productId,
            contractorId,
            pricePerUnit,
            vatPercent: Number(r.vatPercent ?? 0),
            unit: r.product.unit,
            maxQty: Number(r.quantity),
            title: `${r.product.name}${r.product.sku ? ` · ${r.product.sku}` : ''} · ${supplier} · ₴${pricePerUnit.toFixed(2)} (${Number(r.quantity).toLocaleString('uk-UA')} ${r.product.unit})`,
          }
        }),
    )

    function lotByKey(key: string) {
      return lotOptions.value.find((l) => l.key === key)
    }

    function maxQtyFor(key: string) {
      return lotByKey(key)?.maxQty ?? 0
    }

    function unitFor(key: string) {
      return lotByKey(key)?.unit ?? ''
    }

    function openWriteOff() {
      errW.value = ''
      wForm.date = new Date().toISOString().split('T')[0]
      wForm.notes = ''
      const first = lotOptions.value[0]
      wItems.value = [{ lotKey: first?.key ?? '', quantity: 1 }]
      writeOffOpen.value = true
    }

    function openReturn() {
      errR.value = ''
      rForm.date = new Date().toISOString().split('T')[0]
      rForm.notes = ''
      rForm.toWarehouseId = warehouses.value[0]?.id ?? ''
      const first = lotOptions.value[0]
      rItems.value = [{ lotKey: first?.key ?? '', quantity: 1 }]
      returnOpen.value = true
    }

    function addWLine() {
      wItems.value.push({ lotKey: '', quantity: 1 })
    }

    function addRLine() {
      rItems.value.push({ lotKey: '', quantity: 1 })
    }

    function removeW(i: number) {
      wItems.value.splice(i, 1)
    }

    function removeR(i: number) {
      rItems.value.splice(i, 1)
    }

    async function submitWriteOff() {
      errW.value = ''
      const lines = wItems.value.filter((l) => l.lotKey)
      if (lines.length === 0) {
        errW.value = 'Оберіть партію хоча б в одному рядку'
        return
      }
      for (const l of lines) {
        const q = Number(l.quantity)
        if (!Number.isFinite(q) || q <= 0) {
          errW.value = 'Перевірте кількість у рядках'
          return
        }
        const max = maxQtyFor(l.lotKey)
        if (q > max + 1e-9) {
          errW.value = `Кількість перевищує залишок на обʼєкті для однієї з партій (макс. ${max})`
          return
        }
      }
      const items = lines.map((l) => {
        const lot = lotByKey(l.lotKey)!
        return {
          productId: lot.productId,
          contractorId: lot.contractorId,
          pricePerUnit: lot.pricePerUnit,
          vatPercent: lot.vatPercent,
          quantity: Number(l.quantity),
        }
      })
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
        toast.success('Списання з обʼєкта виконано')
      } catch (e: any) {
        errW.value = e?.data?.statusMessage || 'Помилка збереження'
        toast.error(errW.value)
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
      const lines = rItems.value.filter((l) => l.lotKey)
      if (lines.length === 0) {
        errR.value = 'Оберіть партію хоча б в одному рядку'
        return
      }
      for (const l of lines) {
        const q = Number(l.quantity)
        if (!Number.isFinite(q) || q <= 0) {
          errR.value = 'Перевірте кількість у рядках'
          return
        }
        const max = maxQtyFor(l.lotKey)
        if (q > max + 1e-9) {
          errR.value = `Кількість перевищує залишок на обʼєкті (макс. ${max})`
          return
        }
      }
      const items = lines.map((l) => {
        const lot = lotByKey(l.lotKey)!
        return {
          productId: lot.productId,
          contractorId: lot.contractorId,
          pricePerUnit: lot.pricePerUnit,
          vatPercent: lot.vatPercent,
          quantity: Number(l.quantity),
        }
      })
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
        toast.success('Повернення на склад виконано')
      } catch (e: any) {
        errR.value = e?.data?.statusMessage || 'Помилка збереження'
        toast.error(errR.value)
      } finally {
        savingR.value = false
      }
    }

    const hasStock = computed(() => props.stockRows.some((r) => Number(r.quantity) > 0))

    return () => (
      <div class="d-flex flex-wrap gap-2">
        <v-btn
          color="success"
          variant="tonal"
          size="small"
          disabled={!hasStock.value}
          onClick={openWriteOff}
        >
          Використати
        </v-btn>
        <v-btn
          color="primary"
          variant="tonal"
          size="small"
          disabled={!hasStock.value}
          onClick={openReturn}
        >
          Повернути
        </v-btn>

        <v-dialog v-model={writeOffOpen.value} max-width={560}>
          <v-card>
            <v-card-title>Використання матеріалів</v-card-title>
            <v-card-text>
              {errW.value && (
                <v-alert type="error" variant="tonal" class="mb-3">
                  {errW.value}
                </v-alert>
              )}
              <p class="text-body-2 text-medium-emphasis mb-3">
                Фактично використана кількість знімається із залишку на обʼєкті.
              </p>
              <v-text-field v-model={wForm.date} label="Дата *" type="date" class="mb-2" disabled={savingW.value} />
              <v-text-field v-model={wForm.notes} label="Примітки" class="mb-2" disabled={savingW.value} />
              {wItems.value.map((line, index) => (
                <div key={index} class="mb-3">
                  <v-row align="center">
                    <v-col cols={12} md={6}>
                      <v-select
                        v-model={line.lotKey}
                        label="Партія (товар · постачальник · ціна) *"
                        items={lotOptions.value}
                        item-title="title"
                        item-value="key"
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
                        suffix={line.lotKey ? unitFor(line.lotKey) : ''}
                        hide-details
                        disabled={savingW.value || !line.lotKey}
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
                  {line.lotKey ? (
                    <div class="text-caption text-medium-emphasis mt-n2 ms-md-1">
                      На обʼєкті: {maxQtyFor(line.lotKey)} {unitFor(line.lotKey)}
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
              <v-btn color="success" variant="flat" loading={savingW.value} onClick={submitWriteOff}>
                Використати
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
                        v-model={line.lotKey}
                        label="Партія (товар · постачальник · ціна) *"
                        items={lotOptions.value}
                        item-title="title"
                        item-value="key"
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
                        suffix={line.lotKey ? unitFor(line.lotKey) : ''}
                        hide-details
                        disabled={savingR.value || !line.lotKey}
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
                  {line.lotKey ? (
                    <div class="text-caption text-medium-emphasis mt-n2 ms-md-1">
                      На обʼєкті: {maxQtyFor(line.lotKey)} {unitFor(line.lotKey)}
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
