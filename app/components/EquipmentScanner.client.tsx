import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

export interface ScanResult {
  type: 'qr_url' | 'barcode'
  value: string
  /** Розпізнаний ID обладнання (QR із /equipment/{id}) */
  equipmentId?: string
  /** Розпізнаний ID товару (QR із /products/{id}) */
  productId?: string
  format?: string
}

export default defineComponent({
  name: 'EquipmentScanner',
  props: {
    active: { type: Boolean, default: true },
  },
  emits: ['scan', 'error'],
  setup(props, { emit }) {
    const scannerRef = ref<Html5Qrcode | null>(null)
    const scanning = ref(false)
    const cameraError = ref('')
    const containerId = `scanner-${Math.random().toString(36).slice(2, 8)}`

    const supportedFormats = [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.DATA_MATRIX,
    ]

    function parseResult(decodedText: string, result: any): ScanResult {
      if (decodedText.includes('/equipment/')) {
        const match = decodedText.match(/\/equipment\/([a-zA-Z0-9_-]+)/)
        if (match) {
          return { type: 'qr_url', value: decodedText, equipmentId: match[1] }
        }
      }
      if (decodedText.includes('/products/')) {
        const match = decodedText.match(/\/products\/([a-zA-Z0-9_-]+)/)
        if (match) {
          return { type: 'qr_url', value: decodedText, productId: match[1] }
        }
      }
      const formatName = result?.result?.format?.formatName ?? 'unknown'
      return { type: 'barcode', value: decodedText, format: formatName }
    }

    async function startScanning() {
      if (scanning.value || !props.active) return
      cameraError.value = ''

      await nextTick()

      try {
        const scanner = new Html5Qrcode(containerId, {
          formatsToSupport: supportedFormats,
          verbose: false,
        })
        scannerRef.value = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText, result) => {
            const parsed = parseResult(decodedText, result)
            emit('scan', parsed)
          },
          () => {},
        )
        scanning.value = true
      } catch (err: any) {
        cameraError.value = err?.message || 'Не вдалося відкрити камеру'
        emit('error', cameraError.value)
      }
    }

    async function stopScanning() {
      if (scannerRef.value && scanning.value) {
        try {
          await scannerRef.value.stop()
        } catch {}
        scanning.value = false
      }
    }

    watch(() => props.active, async (active) => {
      if (active) {
        await startScanning()
      } else {
        await stopScanning()
      }
    })

    onMounted(() => {
      if (props.active) startScanning()
    })

    onBeforeUnmount(() => {
      stopScanning()
    })

    return () => (
      <div class="equipment-scanner">
        <div id={containerId} class="scanner-viewport" />
        {cameraError.value && (
          <v-alert type="error" variant="tonal" class="mt-3">
            {{
              default: () => cameraError.value,
              append: () => (
                <v-btn variant="text" size="small" onClick={startScanning}>
                  Повторити
                </v-btn>
              ),
            }}
          </v-alert>
        )}
        {!scanning.value && !cameraError.value && props.active && (
          <div class="d-flex justify-center pa-6">
            <v-progress-circular indeterminate color="primary" />
          </div>
        )}
      </div>
    )
  },
})
