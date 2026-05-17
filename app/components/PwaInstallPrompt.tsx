export default defineComponent({
  name: 'PwaInstallPrompt',
  setup() {
    const showInstall = ref(false)
    const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
    const dismissed = ref(false)

    interface BeforeInstallPromptEvent extends Event {
      prompt(): Promise<void>
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
    }

    if (import.meta.client) {
      const dismissedUntil = localStorage.getItem('pwa-install-dismissed')
      if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
        dismissed.value = true
      }

      onMounted(() => {
        window.addEventListener('beforeinstallprompt', (e) => {
          e.preventDefault()
          deferredPrompt.value = e as BeforeInstallPromptEvent
          if (!dismissed.value) showInstall.value = true
        })

        window.addEventListener('appinstalled', () => {
          showInstall.value = false
          deferredPrompt.value = null
        })
      })
    }

    async function install() {
      if (!deferredPrompt.value) return
      await deferredPrompt.value.prompt()
      const { outcome } = await deferredPrompt.value.userChoice
      if (outcome === 'accepted') {
        showInstall.value = false
      }
      deferredPrompt.value = null
    }

    function dismiss() {
      showInstall.value = false
      dismissed.value = true
      localStorage.setItem('pwa-install-dismissed', String(Date.now() + 7 * 24 * 60 * 60 * 1000))
    }

    return () =>
      showInstall.value ? (
        <v-banner
          icon="mdi-cellphone-arrow-down"
          color="primary"
          lines="one"
          stacked={false}
          class="pwa-install-banner"
        >
          {{
            default: () => (
              <span class="text-body-2">
                Встановіть CRM на пристрій для роботи офлайн на об'єктах
              </span>
            ),
            actions: () => (
              <>
                <v-btn
                  variant="text"
                  size="small"
                  class="text-none"
                  onClick={dismiss}
                >
                  Пізніше
                </v-btn>
                <v-btn
                  variant="flat"
                  size="small"
                  color="primary"
                  prepend-icon="mdi-download"
                  class="text-none"
                  onClick={install}
                >
                  Встановити
                </v-btn>
              </>
            ),
          }}
        </v-banner>
      ) : null
  },
})
