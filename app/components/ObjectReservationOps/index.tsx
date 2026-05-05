import type { PropType } from 'vue'

export interface WarehouseReservationRow {
  id: string
  quantity: unknown
  warehouseId: string
  productId: string
  warehouse: { id: string; name: string }
  product: { id: string; name: string; sku?: string | null; unit: string }
}

export default defineComponent({
  name: 'ObjectReservationOps',
  props: {
    objectId: { type: String, required: true },
    reservationRows: { type: Array as PropType<WarehouseReservationRow[]>, default: () => [] },
  },
  emits: {
    success: () => true,
  },
  setup(props, { emit }) {
    const { data: warehousesData } = useFetch('/api/warehouses')
    const warehouses = computed(
      () => (warehousesData.value as any)?.warehouses?.filter((w: any) => w.isActive !== false) ?? [],
    )

    const { data: productsData, pending: productsPending } = useFetch(() =>
      `/api/products?forObjectId=${encodeURIComponent(props.objectId)}`,
    )

    const reserveOpen = ref(false)
    const releaseOpen = ref(false)
    const saving = ref(false)
    const err = ref('')

    const form = reactive({
      warehouseId: '',
      productId: '',
      quantity: 1 as number,
    })

    const releaseForm = reactive({
      compoundId: '',
      quantity: 1 as number,
    })

    const products = computed(() => (productsData.value as any)?.products ?? [])

    const productLinesForWarehouse = computed(() => {
      const wid = form.warehouseId
      if (!wid) return []
      return products.value
        .map((p: any) => {
          const st = (p.stock ?? []).find((s: any) => s.warehouseId === wid)
          if (!st) return null
          const free = Number(st.freeOnWarehouse ?? 0)
          if (free <= 0) return null
          return {
            id: p.id,
            title: `${p.name}${p.sku ? ` · ${p.sku}` : ''}`,
            unit: p.unit,
            freeOnWarehouse: free,
          }
        })
        .filter(Boolean) as { id: string; title: string; unit: string; freeOnWarehouse: number }[]
    })

    function openReserve() {
      err.value = ''
      form.warehouseId = warehouses.value[0]?.id ?? ''
      form.productId = ''
      form.quantity = 1
      reserveOpen.value = true
    }

    function compoundKey(warehouseId: string, productId: string) {
      return `${warehouseId}\t${productId}`
    }

    function openRelease() {
      err.value = ''
      const first = props.reservationRows[0]
      releaseForm.compoundId = first ? compoundKey(first.warehouseId, first.productId) : ''
      releaseForm.quantity = first ? Math.min(1, Number(first.quantity)) : 1
      releaseOpen.value = true
    }

    const releaseOptions = computed(() =>
      props.reservationRows.map((r) => ({
        value: compoundKey(r.warehouseId, r.productId),
        title: `${r.product.name}${r.product.sku ? ` · ${r.product.sku}` : ''} · ${r.warehouse.name}`,
        maxQty: Number(r.quantity),
        unit: r.product.unit,
      })),
    )

    function selectedReleaseLine() {
      return releaseOptions.value.find((o) => o.value === releaseForm.compoundId)
    }

    function maxForRelease() {
      return selectedReleaseLine()?.maxQty ?? 0
    }

    function unitForRelease() {
      return selectedReleaseLine()?.unit ?? ''
    }

    async function submitReserve() {
      err.value = ''
      if (!form.warehouseId || !form.productId) {
        err.value = 'Оберіть склад і товар'
        return
      }
      const q = Number(form.quantity)
      if (!Number.isFinite(q) || q <= 0) {
        err.value = 'Вкажіть кількість більшу за 0'
        return
      }
      const line = productLinesForWarehouse.value.find((l) => l.id === form.productId)
      if (line && q > line.freeOnWarehouse + 1e-9) {
        err.value = `Можна зарезервувати не більше ${line.freeOnWarehouse} ${line.unit}`
        return
      }
      saving.value = true
      try {
        await $fetch(`/api/objects/${props.objectId}/reservations`, {
          method: 'POST',
          body: {
            warehouseId: form.warehouseId,
            productId: form.productId,
            quantityDelta: q,
          },
        })
        reserveOpen.value = false
        emit('success')
      } catch (e: any) {
        err.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        saving.value = false
      }
    }

    async function submitRelease() {
      err.value = ''
      if (!releaseForm.compoundId) {
        err.value = 'Оберіть позицію'
        return
      }
      const parts = releaseForm.compoundId.split('\t')
      const warehouseId = parts[0] ?? ''
      const productId = parts[1] ?? ''
      const q = Number(releaseForm.quantity)
      if (!Number.isFinite(q) || q <= 0) {
        err.value = 'Вкажіть кількість більшу за 0'
        return
      }
      const max = maxForRelease()
      if (q > max + 1e-9) {
        err.value = `Максимум для зняття: ${max}`
        return
      }
      saving.value = true
      try {
        await $fetch(`/api/objects/${props.objectId}/reservations`, {
          method: 'POST',
          body: {
            warehouseId,
            productId,
            quantityDelta: -q,
          },
        })
        releaseOpen.value = false
        emit('success')
      } catch (e: any) {
        err.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        saving.value = false
      }
    }

    const hasReservations = computed(() => props.reservationRows.some((r) => Number(r.quantity) > 0))

    return () => (
      <div class="d-flex flex-wrap gap-2 mb-2 pl-4">
        <v-btn
          color="secondary"
          variant="tonal"
          prepend-icon="mdi-lock-plus"
          loading={productsPending.value}
          onClick={openReserve}
        >
          Зарезервувати на складі
        </v-btn>
        <v-btn
          color="warning"
          variant="tonal"
          prepend-icon="mdi-lock-open-variant"
          disabled={!hasReservations.value}
          onClick={openRelease}
        >
          Зняти резерв
        </v-btn>

        <v-dialog v-model={reserveOpen.value} max-width={560}>
          <v-card>
            <v-card-title>Резерв під цей обʼєкт</v-card-title>
            <v-card-text>
              {err.value && (
                <v-alert type="error" variant="tonal" class="mb-3">
                  {err.value}
                </v-alert>
              )}
              <p class="text-body-2 text-medium-emphasis mb-3">
                Товар залишається фізично на складі, але не буде доступний для переміщення на інший склад. При
                відпуску на цей обʼєкт резерв погашається автоматично.
              </p>
              <v-select
                v-model={form.warehouseId}
                label="Склад *"
                items={warehouses.value}
                item-title="name"
                item-value="id"
                class="mb-3"
                prepend-inner-icon="mdi-warehouse"
                disabled={saving.value}
              />
              <v-select
                v-model={form.productId}
                label="Товар *"
                items={productLinesForWarehouse.value}
                item-title="title"
                item-value="id"
                class="mb-2"
                disabled={saving.value || !form.warehouseId}
                no-data-text={form.warehouseId ? 'Немає вільного залишку на складі' : 'Спочатку оберіть склад'}
              />
              {form.productId ? (
                <div class="text-caption text-medium-emphasis mb-3">
                  Вільно для резерву:{' '}
                  {productLinesForWarehouse.value.find((l) => l.id === form.productId)?.freeOnWarehouse ?? 0}{' '}
                  {productLinesForWarehouse.value.find((l) => l.id === form.productId)?.unit ?? ''}
                </div>
              ) : null}
              <v-text-field
                v-model={form.quantity}
                label="Кількість *"
                type="number"
                min={0.001}
                step={0.001}
                class="mb-2"
                disabled={saving.value}
              />
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" disabled={saving.value} onClick={() => (reserveOpen.value = false)}>
                Скасувати
              </v-btn>
              <v-btn color="primary" variant="flat" loading={saving.value} onClick={submitReserve}>
                Зарезервувати
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model={releaseOpen.value} max-width={520}>
          <v-card>
            <v-card-title>Зняти резерв</v-card-title>
            <v-card-text>
              {err.value && (
                <v-alert type="error" variant="tonal" class="mb-3">
                  {err.value}
                </v-alert>
              )}
              <v-select
                v-model={releaseForm.compoundId}
                label="Позиція *"
                items={releaseOptions.value}
                item-title="title"
                item-value="value"
                class="mb-3"
                disabled={saving.value}
              />
              <v-text-field
                v-model={releaseForm.quantity}
                label="Кількість *"
                type="number"
                min={0.001}
                step={0.001}
                suffix={releaseForm.compoundId ? unitForRelease() : ''}
                disabled={saving.value}
              />
              {releaseForm.compoundId ? (
                <div class="text-caption text-medium-emphasis mt-1">
                  Зарезервовано: {maxForRelease()} {unitForRelease()}
                </div>
              ) : null}
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" disabled={saving.value} onClick={() => (releaseOpen.value = false)}>
                Скасувати
              </v-btn>
              <v-btn color="warning" variant="flat" loading={saving.value} onClick={submitRelease}>
                Зняти
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
