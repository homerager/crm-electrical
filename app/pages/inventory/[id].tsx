export default defineComponent({
  name: 'MaterialInventorySessionPage',
  setup() {
    definePageMeta({ middleware: ['auth'], permission: 'inventory.view' })

    const route = useRoute()
    const id = computed(() => route.params.id as string)

    const toast = useToast()
    const { data, refresh, pending } = useFetch(computed(() => `/api/material-inventory/${id.value}`))
    const session = computed(() => (data.value as any)?.session)

    useHead({ title: computed(() => session.value ? `Інвентаризація — ${session.value.warehouse?.name || ''}` : 'Інвентаризація матеріалів') })

    const scannerActive = ref(false)
    const scanLoading = ref(false)
    const scanResult = ref<any>(null)
    const scanError = ref('')
    const lastScanValue = ref('')

    const tab = ref('scan')

    const reportData = ref<any>(null)
    const reportLoading = ref(false)

    async function loadReport() {
      reportLoading.value = true
      try {
        reportData.value = await $fetch(`/api/material-inventory/${id.value}/report`)
      } catch {}
      reportLoading.value = false
    }

    watch(tab, (v) => {
      if (v === 'report') loadReport()
    })

    function startScanning() {
      scanResult.value = null
      scanError.value = ''
      lastScanValue.value = ''
      scannerActive.value = true
    }

    function stopScanning() {
      scannerActive.value = false
    }

    async function handleScan(result: any) {
      if (scanLoading.value) return
      if (result.value === lastScanValue.value) return
      lastScanValue.value = result.value

      scanLoading.value = true
      scanError.value = ''
      scanResult.value = null

      try {
        const body: any = {}
        if (result.type === 'qr_url' && result.productId) {
          body.productId = result.productId
        } else {
          body.barcode = result.value
        }
        const res = await $fetch(`/api/material-inventory/${id.value}/scan`, { method: 'POST', body })
        scanResult.value = res
        await refresh()
      } catch (e: any) {
        if (e?.data?.statusCode === 404) {
          scanError.value = 'Товар не знайдено в системі (перевірте штрих-код)'
        } else {
          scanError.value = e?.data?.statusMessage || 'Помилка сканування'
        }
      } finally {
        scanLoading.value = false
        setTimeout(() => { lastScanValue.value = '' }, 2000)
      }
    }

    // Manual count entry
    const savingProductId = ref('')
    async function saveCount(productId: string, value: unknown) {
      const raw = value === '' || value == null ? null : Number(value)
      if (raw !== null && (!Number.isFinite(raw) || raw < 0)) {
        toast.error('Кількість має бути числом ≥ 0')
        return
      }
      savingProductId.value = productId
      try {
        await $fetch(`/api/material-inventory/${id.value}/scan`, {
          method: 'POST',
          body: { productId, countedQty: raw === null ? 0 : raw },
        })
        await refresh()
      } catch (e: any) {
        toast.error(e?.data?.statusMessage || 'Помилка збереження')
      } finally {
        savingProductId.value = ''
      }
    }

    // Complete
    const completeDialog = ref(false)
    const applyAdjustments = ref(true)
    const completing = ref(false)

    async function completeSession() {
      completing.value = true
      try {
        await $fetch(`/api/material-inventory/${id.value}/complete`, {
          method: 'POST',
          body: { applyAdjustments: applyAdjustments.value },
        })
        completeDialog.value = false
        await refresh()
        tab.value = 'report'
        await loadReport()
        toast.success('Інвентаризацію завершено')
      } catch (e: any) {
        toast.error(e?.data?.statusMessage || 'Помилка завершення інвентаризації')
      } finally {
        completing.value = false
      }
    }

    function formatDate(d: string | null) {
      if (!d) return '—'
      return new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    function fmtQty(v: unknown) {
      if (v == null) return '—'
      return Number(v).toLocaleString('uk-UA', { maximumFractionDigits: 3 })
    }

    const scanResultColor = computed(() => {
      if (!scanResult.value) return ''
      const sr = scanResult.value.scanResult
      if (sr === 'matched') return 'success'
      if (sr === 'shortage') return 'warning'
      if (sr === 'surplus') return 'info'
      if (sr === 'unexpected') return 'warning'
      return ''
    })

    const scanResultText = computed(() => {
      if (!scanResult.value) return ''
      const sr = scanResult.value.scanResult
      if (sr === 'matched') return 'Збігається з обліком'
      if (sr === 'shortage') return 'Менше, ніж в обліку'
      if (sr === 'surplus') return 'Більше, ніж в обліку'
      if (sr === 'unexpected') return 'Не числиться на цьому складі'
      return ''
    })

    const countedCount = computed(() => {
      const items = session.value?.items ?? []
      return items.filter((i: any) => i.countedQty !== null).length
    })

    const totalCount = computed(() => session.value?.items?.length ?? 0)

    function diffOf(item: any): number | null {
      if (item.countedQty === null) return null
      return Number(item.countedQty) - Number(item.expectedQty)
    }

    return () => {
      if (pending.value && !session.value) {
        return (
          <div class="d-flex justify-center pa-12">
            <v-progress-circular indeterminate color="primary" size="48" />
          </div>
        )
      }

      if (!session.value) {
        return (
          <v-alert type="error" variant="tonal" class="ma-4">
            Сесію інвентаризації не знайдено
          </v-alert>
        )
      }

      const s = session.value
      const isActive = s.status !== 'COMPLETED'
      const locationName = s.warehouse?.name || '—'

      return (
        <div>
          <div class="page-toolbar">
            <v-btn icon="mdi-arrow-left" variant="text" to="/inventory" />
            <div class="ml-2">
              <div class="text-h5 font-weight-bold">Інвентаризація: {locationName}</div>
              <div class="text-body-2 text-medium-emphasis">
                {formatDate(s.startedAt)} • {s.startedBy?.name}
                {' • '}
                <v-chip size="x-small" color={isActive ? 'warning' : 'success'} variant="tonal">
                  {isActive ? 'В процесі' : 'Завершена'}
                </v-chip>
              </div>
            </div>
            <v-spacer />
            {isActive && (
              <v-btn color="success" variant="elevated" prepend-icon="mdi-check" onClick={() => (completeDialog.value = true)}>
                Завершити
              </v-btn>
            )}
          </div>

          {/* Progress */}
          <v-card class="mb-4">
            <v-card-text>
              <div class="d-flex align-center justify-space-between mb-2">
                <span class="text-body-2">Пораховано позицій: {countedCount.value} / {totalCount.value}</span>
                <span class="text-body-2 font-weight-medium">
                  {totalCount.value > 0 ? Math.round((countedCount.value / totalCount.value) * 100) : 0}%
                </span>
              </div>
              <v-progress-linear
                model-value={totalCount.value > 0 ? (countedCount.value / totalCount.value) * 100 : 0}
                color="primary"
                height={8}
                rounded
              />
            </v-card-text>
          </v-card>

          <v-tabs v-model={tab.value} class="mb-4">
            {isActive && <v-tab value="scan">Сканування</v-tab>}
            <v-tab value="items">Список ({totalCount.value})</v-tab>
            <v-tab value="report">Звіт</v-tab>
          </v-tabs>

          <v-window v-model={tab.value}>
            {/* Scan tab */}
            {isActive && (
              <v-window-item value="scan">
                {!scannerActive.value ? (
                  <v-card>
                    <v-card-text class="text-center pa-8">
                      <v-icon size="64" color="primary" class="mb-4">mdi-barcode-scan</v-icon>
                      <div class="text-h6 mb-2">Сканування товарів</div>
                      <div class="text-body-2 text-medium-emphasis mb-4">
                        Скануйте штрих-код товару — кожне сканування додає +1 до фактичної кількості. Точну кількість можна ввести вручну на вкладці «Список».
                      </div>
                      <v-btn color="primary" size="large" prepend-icon="mdi-camera" onClick={startScanning}>
                        Почати сканування
                      </v-btn>
                    </v-card-text>
                  </v-card>
                ) : (
                  <div>
                    <v-card class="mb-4">
                      <v-card-text class="pa-0">
                        <EquipmentScanner active={scannerActive.value} onScan={handleScan} />
                      </v-card-text>
                      <v-card-actions class="justify-center">
                        <v-btn variant="outlined" prepend-icon="mdi-stop" onClick={stopScanning}>
                          Зупинити
                        </v-btn>
                      </v-card-actions>
                    </v-card>

                    {scanLoading.value && (
                      <v-card class="mb-4">
                        <v-card-text class="d-flex align-center justify-center pa-4">
                          <v-progress-circular indeterminate size="24" class="mr-2" />
                          Перевірка...
                        </v-card-text>
                      </v-card>
                    )}

                    {scanError.value && (
                      <v-alert type="error" variant="tonal" class="mb-4">{scanError.value}</v-alert>
                    )}

                    {scanResult.value && (
                      <v-alert type={scanResultColor.value as any} variant="tonal" class="mb-4">
                        <div class="font-weight-medium">{scanResultText.value}</div>
                        <div class="text-body-2 mt-1">
                          {scanResult.value.product?.name}
                          {' — пораховано: '}
                          <strong>{fmtQty(scanResult.value.item?.countedQty)}</strong>
                          {' / облік: '}
                          {fmtQty(scanResult.value.item?.expectedQty)}
                          {' '}{scanResult.value.product?.unit}
                        </div>
                      </v-alert>
                    )}
                  </div>
                )}
              </v-window-item>
            )}

            {/* Items list tab */}
            <v-window-item value="items">
              <v-card>
                <v-data-table
                  headers={[
                    { title: 'Товар', key: 'product.name' },
                    { title: 'Штрих-код', key: 'product.barcode', sortable: false },
                    { title: 'Облік', key: 'expectedQty', width: 120 },
                    { title: 'Факт', key: 'countedQty', width: 180 },
                    { title: 'Розбіжність', key: 'diff', width: 140 },
                  ]}
                  items={s.items ?? []}
                  items-per-page={50}
                  hover
                >
                  {{
                    'item.product.barcode': ({ item }: any) => (
                      item.product?.barcode
                        ? <v-chip size="x-small" variant="outlined" prepend-icon="mdi-barcode">{item.product.barcode}</v-chip>
                        : <span class="text-medium-emphasis">—</span>
                    ),
                    'item.expectedQty': ({ item }: any) => (
                      <span>{fmtQty(item.expectedQty)} {item.product?.unit}</span>
                    ),
                    'item.countedQty': ({ item }: any) => (
                      isActive ? (
                        <v-text-field
                          model-value={item.countedQty === null ? '' : Number(item.countedQty)}
                          type="number"
                          density="compact"
                          variant="outlined"
                          hide-details
                          placeholder="—"
                          loading={savingProductId.value === item.productId}
                          style="max-width: 150px"
                          onChange={(e: any) => saveCount(item.productId, e?.target?.value)}
                        />
                      ) : (
                        <span>{fmtQty(item.countedQty)}</span>
                      )
                    ),
                    'item.diff': ({ item }: any) => {
                      const d = diffOf(item)
                      if (d === null) return <span class="text-medium-emphasis">не пораховано</span>
                      if (d === 0) return <v-chip size="small" color="success" variant="tonal">0</v-chip>
                      return (
                        <v-chip size="small" color={d < 0 ? 'error' : 'info'} variant="tonal">
                          {d > 0 ? '+' : ''}{fmtQty(d)}
                        </v-chip>
                      )
                    },
                  }}
                </v-data-table>
              </v-card>
            </v-window-item>

            {/* Report tab */}
            <v-window-item value="report">
              {reportLoading.value ? (
                <div class="d-flex justify-center pa-8">
                  <v-progress-circular indeterminate size="32" />
                </div>
              ) : reportData.value ? (
                <div>
                  <v-row class="mb-4">
                    <v-col cols={6} sm={3}>
                      <v-card color="primary" variant="tonal">
                        <v-card-text class="text-center">
                          <div class="text-h4 font-weight-bold">{reportData.value.summary?.totalProducts ?? 0}</div>
                          <div class="text-caption">Позицій</div>
                        </v-card-text>
                      </v-card>
                    </v-col>
                    <v-col cols={6} sm={3}>
                      <v-card color="success" variant="tonal">
                        <v-card-text class="text-center">
                          <div class="text-h4 font-weight-bold">{reportData.value.summary?.matched ?? 0}</div>
                          <div class="text-caption">Збігається</div>
                        </v-card-text>
                      </v-card>
                    </v-col>
                    <v-col cols={6} sm={3}>
                      <v-card color="error" variant="tonal">
                        <v-card-text class="text-center">
                          <div class="text-h4 font-weight-bold">{reportData.value.summary?.shortage ?? 0}</div>
                          <div class="text-caption">Нестача</div>
                        </v-card-text>
                      </v-card>
                    </v-col>
                    <v-col cols={6} sm={3}>
                      <v-card color="info" variant="tonal">
                        <v-card-text class="text-center">
                          <div class="text-h4 font-weight-bold">{reportData.value.summary?.surplus ?? 0}</div>
                          <div class="text-caption">Надлишок</div>
                        </v-card-text>
                      </v-card>
                    </v-col>
                  </v-row>

                  {reportData.value.shortage?.length > 0 && (
                    <DiscrepancyCard
                      title="Нестача"
                      icon="mdi-trending-down"
                      color="error"
                      items={reportData.value.shortage}
                      fmtQty={fmtQty}
                    />
                  )}
                  {reportData.value.surplus?.length > 0 && (
                    <DiscrepancyCard
                      title="Надлишок"
                      icon="mdi-trending-up"
                      color="info"
                      items={reportData.value.surplus}
                      fmtQty={fmtQty}
                    />
                  )}
                  {reportData.value.notCounted?.length > 0 && (
                    <DiscrepancyCard
                      title="Не пораховано"
                      icon="mdi-help-circle-outline"
                      color="warning"
                      items={reportData.value.notCounted}
                      fmtQty={fmtQty}
                    />
                  )}
                  {reportData.value.matched?.length > 0 && (
                    <DiscrepancyCard
                      title="Збігається з обліком"
                      icon="mdi-check-circle"
                      color="success"
                      items={reportData.value.matched}
                      fmtQty={fmtQty}
                    />
                  )}
                </div>
              ) : (
                <v-card>
                  <v-card-text class="text-center pa-8 text-medium-emphasis">
                    Натисніть вкладку «Звіт» для перегляду
                  </v-card-text>
                </v-card>
              )}
            </v-window-item>
          </v-window>

          {/* Complete dialog */}
          <v-dialog v-model={completeDialog.value} max-width={480}>
            <v-card>
              <v-card-title>Завершити інвентаризацію?</v-card-title>
              <v-card-text>
                <p class="text-body-2 mb-3">
                  Після завершення сесію не можна буде редагувати. Позиції без введеної фактичної кількості залишаться без змін.
                </p>
                <v-checkbox
                  v-model={applyAdjustments.value}
                  hide-details
                  density="compact"
                  label="Привести залишки на складі до фактично порахованих"
                />
                <div class="text-caption text-medium-emphasis ml-8">
                  Для позицій з розбіжністю буде оновлено залишок WarehouseStock та записано в журнал змін.
                </div>
              </v-card-text>
              <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="outlined" onClick={() => (completeDialog.value = false)}>Скасувати</v-btn>
                <v-btn color="success" variant="elevated" loading={completing.value} onClick={completeSession}>
                  Завершити
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </div>
      )
    }
  },
})

const DiscrepancyCard = defineComponent({
  name: 'DiscrepancyCard',
  props: {
    title: { type: String, required: true },
    icon: { type: String, required: true },
    color: { type: String, required: true },
    items: { type: Array as () => any[], required: true },
    fmtQty: { type: Function as unknown as () => (v: unknown) => string, required: true },
  },
  setup(props) {
    return () => (
      <v-card class="mb-4">
        <v-card-title class="d-flex align-center">
          <v-icon color={props.color} class="mr-2">{props.icon}</v-icon>
          {props.title} ({props.items.length})
        </v-card-title>
        <v-card-text>
          <v-list density="compact">
            {props.items.map((item: any) => (
              <v-list-item key={item.productId}>
                {{
                  default: () => (
                    <>
                      <v-list-item-title>{item.product?.name}</v-list-item-title>
                      <v-list-item-subtitle>
                        {[item.product?.sku, item.product?.barcode].filter(Boolean).join(' • ') || '—'}
                      </v-list-item-subtitle>
                    </>
                  ),
                  append: () => (
                    <div class="text-right">
                      <div class="text-caption">
                        Облік: {props.fmtQty(item.expectedQty)} {item.product?.unit}
                      </div>
                      <div class="text-caption font-weight-medium">
                        Факт: {props.fmtQty(item.countedQty)} {item.product?.unit}
                      </div>
                    </div>
                  ),
                }}
              </v-list-item>
            ))}
          </v-list>
        </v-card-text>
      </v-card>
    )
  },
})
