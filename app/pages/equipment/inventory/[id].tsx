export default defineComponent({
  name: 'InventorySessionPage',
  setup() {
    definePageMeta({ middleware: ['auth'], permission: 'equipment.view' })

    const route = useRoute()
    const router = useRouter()
    const id = computed(() => route.params.id as string)

    const toast = useToast()
    const { data, refresh, pending } = useFetch(computed(() => `/api/inventory-sessions/${id.value}`))
    const session = computed(() => (data.value as any)?.session)

    useHead({ title: computed(() => session.value ? `Інвентаризація — ${session.value.warehouse?.name || session.value.object?.name || ''}` : 'Інвентаризація') })

    const scannerActive = ref(false)
    const scanLoading = ref(false)
    const scanResult = ref<any>(null)
    const scanError = ref('')
    const lastScanValue = ref('')

    const tab = ref('scan')

    // Report data
    const reportData = ref<any>(null)
    const reportLoading = ref(false)

    async function loadReport() {
      reportLoading.value = true
      try {
        reportData.value = await $fetch(`/api/inventory-sessions/${id.value}/report`)
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
        if (result.type === 'qr_url' && result.equipmentId) {
          body.equipmentId = result.equipmentId
        } else {
          body.barcode = result.value
        }
        const res = await $fetch(`/api/inventory-sessions/${id.value}/scan`, { method: 'POST', body })
        scanResult.value = res
        await refresh()
      } catch (e: any) {
        if (e?.data?.statusCode === 404) {
          scanError.value = 'Обладнання не знайдено в системі'
        } else {
          scanError.value = e?.data?.statusMessage || 'Помилка сканування'
        }
      } finally {
        scanLoading.value = false
        setTimeout(() => { lastScanValue.value = '' }, 2000)
      }
    }

    async function completeSession() {
      try {
        await $fetch(`/api/inventory-sessions/${id.value}/complete`, { method: 'POST' })
        await refresh()
        tab.value = 'report'
        await loadReport()
        toast.success('Інвентаризацію завершено')
      } catch (e: any) {
        toast.error(e?.data?.statusMessage || 'Помилка завершення інвентаризації')
      }
    }

    function formatDate(d: string | null) {
      if (!d) return '—'
      return new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    const scanResultColor = computed(() => {
      if (!scanResult.value) return ''
      const sr = scanResult.value.scanResult
      if (sr === 'found') return 'success'
      if (sr === 'unexpected') return 'warning'
      if (sr === 'already_scanned') return 'info'
      return ''
    })

    const scanResultText = computed(() => {
      if (!scanResult.value) return ''
      const sr = scanResult.value.scanResult
      if (sr === 'found') return 'Знайдено — відповідає обліку'
      if (sr === 'unexpected') return 'Зайве — числиться в іншому місці'
      if (sr === 'already_scanned') return 'Вже відсканованo раніше'
      return ''
    })

    const scannedCount = computed(() => {
      const items = session.value?.items ?? []
      return items.filter((i: any) => i.found).length
    })

    const totalCount = computed(() => {
      return session.value?.items?.length ?? 0
    })

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
      const locationName = s.warehouse?.name || s.object?.name || '—'

      return (
        <div>
          <div class="page-toolbar">
            <v-btn icon="mdi-arrow-left" variant="text" to="/equipment/inventory" />
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
              <v-btn color="success" variant="elevated" prepend-icon="mdi-check" onClick={completeSession}>
                Завершити
              </v-btn>
            )}
          </div>

          {/* Progress */}
          <v-card class="mb-4">
            <v-card-text>
              <div class="d-flex align-center justify-space-between mb-2">
                <span class="text-body-2">Відсканованo: {scannedCount.value} / {totalCount.value}</span>
                <span class="text-body-2 font-weight-medium">
                  {totalCount.value > 0 ? Math.round((scannedCount.value / totalCount.value) * 100) : 0}%
                </span>
              </div>
              <v-progress-linear
                model-value={totalCount.value > 0 ? (scannedCount.value / totalCount.value) * 100 : 0}
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
                      <v-icon size="64" color="primary" class="mb-4">mdi-qrcode-scan</v-icon>
                      <div class="text-h6 mb-2">Сканування обладнання</div>
                      <div class="text-body-2 text-medium-emphasis mb-4">
                        Натисніть кнопку, щоб почати сканування обладнання на цій локації
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
                          {scanResult.value.equipment?.name}
                          {scanResult.value.equipment?.model && ` • ${scanResult.value.equipment.model}`}
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
                    { title: 'Назва', key: 'equipment.name' },
                    { title: 'Модель', key: 'equipment.model' },
                    { title: 'Серійний №', key: 'equipment.serialNumber' },
                    { title: 'Статус', key: 'found', width: 140 },
                    { title: 'Час сканування', key: 'scannedAt', width: 180 },
                  ]}
                  items={s.items ?? []}
                  items-per-page={50}
                  hover
                >
                  {{
                    'item.found': ({ item }: any) => (
                      <v-chip size="small" color={item.found ? 'success' : 'error'} variant="tonal">
                        {item.found ? 'Знайдено' : 'Не знайдено'}
                      </v-chip>
                    ),
                    'item.scannedAt': ({ item }: any) => (
                      <span>{item.scannedAt ? formatDate(item.scannedAt) : '—'}</span>
                    ),
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
                  {/* Summary cards */}
                  <v-row class="mb-4">
                    <v-col cols={6} sm={3}>
                      <v-card color="primary" variant="tonal">
                        <v-card-text class="text-center">
                          <div class="text-h4 font-weight-bold">{reportData.value.summary?.totalExpected ?? 0}</div>
                          <div class="text-caption">Очікувалось</div>
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
                          <div class="text-h4 font-weight-bold">{reportData.value.summary?.notFound ?? 0}</div>
                          <div class="text-caption">Не знайдено</div>
                        </v-card-text>
                      </v-card>
                    </v-col>
                    <v-col cols={6} sm={3}>
                      <v-card color="warning" variant="tonal">
                        <v-card-text class="text-center">
                          <div class="text-h4 font-weight-bold">{reportData.value.summary?.unexpected ?? 0}</div>
                          <div class="text-caption">Зайве</div>
                        </v-card-text>
                      </v-card>
                    </v-col>
                  </v-row>

                  {/* Not found section */}
                  {reportData.value.notFound?.length > 0 && (
                    <v-card class="mb-4">
                      <v-card-title class="d-flex align-center">
                        <v-icon color="error" class="mr-2">mdi-alert-circle</v-icon>
                        Не знайдено ({reportData.value.notFound.length})
                      </v-card-title>
                      <v-card-text>
                        <v-list density="compact">
                          {reportData.value.notFound.map((item: any) => (
                            <v-list-item
                              key={item.equipmentId}
                              to={`/equipment/${item.equipmentId}`}
                            >
                              <v-list-item-title>{item.equipment.name}</v-list-item-title>
                              <v-list-item-subtitle>
                                {[item.equipment.model, item.equipment.serialNumber].filter(Boolean).join(' • ')}
                              </v-list-item-subtitle>
                            </v-list-item>
                          ))}
                        </v-list>
                      </v-card-text>
                    </v-card>
                  )}

                  {/* Unexpected section */}
                  {reportData.value.unexpected?.length > 0 && (
                    <v-card class="mb-4">
                      <v-card-title class="d-flex align-center">
                        <v-icon color="warning" class="mr-2">mdi-alert</v-icon>
                        Зайве ({reportData.value.unexpected.length})
                      </v-card-title>
                      <v-card-text>
                        <v-list density="compact">
                          {reportData.value.unexpected.map((item: any) => (
                            <v-list-item
                              key={item.equipmentId}
                              to={`/equipment/${item.equipmentId}`}
                            >
                              <v-list-item-title>{item.equipment.name}</v-list-item-title>
                              <v-list-item-subtitle>
                                {[item.equipment.model, item.equipment.serialNumber].filter(Boolean).join(' • ')}
                              </v-list-item-subtitle>
                            </v-list-item>
                          ))}
                        </v-list>
                      </v-card-text>
                    </v-card>
                  )}

                  {/* Matched section */}
                  {reportData.value.matched?.length > 0 && (
                    <v-card>
                      <v-card-title class="d-flex align-center">
                        <v-icon color="success" class="mr-2">mdi-check-circle</v-icon>
                        Знайдено на місці ({reportData.value.matched.length})
                      </v-card-title>
                      <v-card-text>
                        <v-list density="compact">
                          {reportData.value.matched.map((item: any) => (
                            <v-list-item
                              key={item.equipmentId}
                              to={`/equipment/${item.equipmentId}`}
                            >
                              <v-list-item-title>{item.equipment.name}</v-list-item-title>
                              <v-list-item-subtitle>
                                {[item.equipment.model, item.equipment.serialNumber].filter(Boolean).join(' • ')}
                              </v-list-item-subtitle>
                            </v-list-item>
                          ))}
                        </v-list>
                      </v-card-text>
                    </v-card>
                  )}
                </div>
              ) : (
                <v-card>
                  <v-card-text class="text-center pa-8 text-medium-emphasis">
                    {isActive ? 'Звіт буде доступний після завершення сесії' : 'Натисніть вкладку "Звіт" для перегляду'}
                  </v-card-text>
                </v-card>
              )}
            </v-window-item>
          </v-window>
        </div>
      )
    }
  },
})
