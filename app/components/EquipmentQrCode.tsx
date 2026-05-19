import QRCode from 'qrcode'

export default defineComponent({
  name: 'EquipmentQrCode',
  props: {
    equipmentId: { type: String, required: true },
    name: { type: String, default: '' },
    size: { type: Number, default: 200 },
    baseUrl: { type: String, default: '' },
  },
  setup(props) {
    const svgData = ref('')

    const qrUrl = computed(() => {
      const base = props.baseUrl || (import.meta.client ? window.location.origin : '')
      return `${base}/equipment/${props.equipmentId}`
    })

    async function generateQr() {
      try {
        svgData.value = await QRCode.toString(qrUrl.value, {
          type: 'svg',
          width: props.size,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
      } catch {
        svgData.value = ''
      }
    }

    watch(() => props.equipmentId, generateQr, { immediate: true })

    return () => (
      <div class="equipment-qr-code text-center">
        {svgData.value ? (
          <div innerHTML={svgData.value} />
        ) : (
          <v-progress-circular indeterminate size="24" />
        )}
        {props.name && (
          <div class="text-caption mt-1 text-truncate" style={{ maxWidth: `${props.size}px` }}>
            {props.name}
          </div>
        )}
      </div>
    )
  },
})
