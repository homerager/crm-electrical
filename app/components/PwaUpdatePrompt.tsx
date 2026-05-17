export default defineComponent({
  name: 'PwaUpdatePrompt',
  setup() {
    const showUpdate = ref(false)
    let registration: ServiceWorkerRegistration | null = null

    if (import.meta.client) {
      onMounted(async () => {
        const { registerSW } = await import('virtual:pwa-register')
        registerSW({
          immediate: true,
          onNeedRefresh() {
            showUpdate.value = true
          },
          onRegisteredSW(swUrl, r) {
            registration = r ?? null
          },
        })
      })
    }

    function update() {
      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
      showUpdate.value = false
      window.location.reload()
    }

    return () =>
      showUpdate.value ? (
        <v-snackbar
          modelValue={showUpdate.value}
          timeout={-1}
          color="primary"
          location="bottom"
        >
          {{
            default: () => 'Доступне оновлення додатку',
            actions: () => (
              <v-btn variant="text" onClick={update}>
                Оновити
              </v-btn>
            ),
          }}
        </v-snackbar>
      ) : null
  },
})
