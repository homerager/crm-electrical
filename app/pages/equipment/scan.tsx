const STATUS_LABELS: Record<string, string> = {
  IN_STOCK: 'На складі',
  INSTALLED: 'Встановлено',
  IN_REPAIR: 'На ремонті',
  DECOMMISSIONED: 'Списано',
  IN_TRANSIT: 'В дорозі',
}

const STATUS_COLORS: Record<string, string> = {
  IN_STOCK: 'success',
  INSTALLED: 'primary',
  IN_REPAIR: 'warning',
  DECOMMISSIONED: 'grey',
  IN_TRANSIT: 'info',
}

export default defineComponent({
  name: 'EquipmentScanPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Сканер обладнання' })

    const router = useRouter()

    const scannerActive = ref(true)
    const foundEquipment = ref<any>(null)
    const loading = ref(false)
    const error = ref('')
    const lastScanValue = ref('')

    async function handleScan(result: any) {
      if (loading.value) return
      if (result.value === lastScanValue.value) return
      lastScanValue.value = result.value

      scannerActive.value = false
      loading.value = true
      error.value = ''
      foundEquipment.value = null

      try {
        let data: any
        if (result.type === 'qr_url' && result.equipmentId) {
          data = await $fetch(`/api/equipment/${result.equipmentId}`)
        } else {
          data = await $fetch('/api/equipment/lookup', { query: { barcode: result.value } })
        }
        foundEquipment.value = data.equipment
      } catch (e: any) {
        if (e?.data?.statusCode === 404) {
          error.value = 'Обладнання не знайдено в системі'
        } else {
          error.value = e?.data?.statusMessage || 'Помилка пошуку'
        }
      } finally {
        loading.value = false
      }
    }

    function handleError(msg: string) {
      error.value = msg
    }

    function resetScan() {
      foundEquipment.value = null
      error.value = ''
      lastScanValue.value = ''
      scannerActive.value = true
    }

    function goToCard() {
      if (foundEquipment.value) {
        router.push(`/equipment/${foundEquipment.value.id}`)
      }
    }

    return () => (
      <div>
        <div class="page-toolbar">
          <v-btn icon="mdi-arrow-left" variant="text" to="/equipment" />
          <div class="text-h5 font-weight-bold ml-2">Сканер обладнання</div>
        </div>

        {scannerActive.value && (
          <v-card class="mb-4">
            <v-card-text class="pa-0">
              <EquipmentScanner active={scannerActive.value} onScan={handleScan} onError={handleError} />
            </v-card-text>
            <v-card-text class="text-center text-body-2 text-medium-emphasis">
              Наведіть камеру на QR-код або штрих-код обладнання
            </v-card-text>
          </v-card>
        )}

        {loading.value && (
          <v-card class="mb-4">
            <v-card-text class="d-flex align-center justify-center pa-8">
              <v-progress-circular indeterminate color="primary" class="mr-3" />
              <span>Пошук обладнання...</span>
            </v-card-text>
          </v-card>
        )}

        {error.value && !loading.value && (
          <v-card class="mb-4">
            <v-card-text>
              <v-alert type="warning" variant="tonal" class="mb-4">{error.value}</v-alert>
              <div class="d-flex justify-center">
                <v-btn color="primary" variant="elevated" prepend-icon="mdi-qrcode-scan" onClick={resetScan}>
                  Сканувати ще
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        )}

        {foundEquipment.value && !loading.value && (
          <v-card class="mb-4">
            <v-card-title class="d-flex align-center">
              <v-icon color="success" class="mr-2">mdi-check-circle</v-icon>
              Знайдено
            </v-card-title>
            <v-card-text>
              <v-list density="compact" class="bg-transparent">
                <v-list-item>
                  <v-list-item-title class="font-weight-bold text-h6">{foundEquipment.value.name}</v-list-item-title>
                </v-list-item>
                {foundEquipment.value.model && (
                  <v-list-item>
                    <v-list-item-title class="text-caption text-medium-emphasis">Модель</v-list-item-title>
                    <v-list-item-subtitle>{foundEquipment.value.model}</v-list-item-subtitle>
                  </v-list-item>
                )}
                {foundEquipment.value.serialNumber && (
                  <v-list-item>
                    <v-list-item-title class="text-caption text-medium-emphasis">Серійний №</v-list-item-title>
                    <v-list-item-subtitle>{foundEquipment.value.serialNumber}</v-list-item-subtitle>
                  </v-list-item>
                )}
                <v-list-item>
                  <v-list-item-title class="text-caption text-medium-emphasis">Статус</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip size="small" color={STATUS_COLORS[foundEquipment.value.status]} variant="tonal">
                      {STATUS_LABELS[foundEquipment.value.status]}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title class="text-caption text-medium-emphasis">Місцезнаходження</v-list-item-title>
                  <v-list-item-subtitle>
                    {foundEquipment.value.currentWarehouse?.name || foundEquipment.value.currentObject?.name || '—'}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-btn variant="outlined" prepend-icon="mdi-qrcode-scan" onClick={resetScan}>
                Сканувати ще
              </v-btn>
              <v-spacer />
              <v-btn color="primary" variant="elevated" prepend-icon="mdi-eye" onClick={goToCard}>
                Відкрити картку
              </v-btn>
            </v-card-actions>
          </v-card>
        )}
      </div>
    )
  },
})
