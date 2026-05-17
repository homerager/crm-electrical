interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePwaInstall() {
  const canInstall = ref(false)
  const isInstalled = ref(false)
  const isIos = ref(false)
  const isIosPromptDismissed = ref(false)
  const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)

  if (import.meta.client) {
    isIos.value = /iphone|ipad|ipod/i.test(navigator.userAgent)
      && !('standalone' in navigator && (navigator as any).standalone)

    isInstalled.value = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true

    const dismissedUntil = localStorage.getItem('pwa-ios-dismissed')
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
      isIosPromptDismissed.value = true
    }

    onMounted(() => {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault()
        deferredPrompt.value = e as BeforeInstallPromptEvent
        canInstall.value = true
      })

      window.addEventListener('appinstalled', () => {
        canInstall.value = false
        isInstalled.value = true
        deferredPrompt.value = null
      })
    })
  }

  async function install() {
    if (!deferredPrompt.value) return
    await deferredPrompt.value.prompt()
    const { outcome } = await deferredPrompt.value.userChoice
    if (outcome === 'accepted') {
      canInstall.value = false
      isInstalled.value = true
    }
    deferredPrompt.value = null
  }

  function dismissIos() {
    isIosPromptDismissed.value = true
    localStorage.setItem('pwa-ios-dismissed', String(Date.now() + 7 * 24 * 60 * 60 * 1000))
  }

  const showIosBanner = computed(
    () => isIos.value && !isInstalled.value && !isIosPromptDismissed.value,
  )

  return { canInstall, isInstalled, isIos, showIosBanner, install, dismissIos }
}

export default defineComponent({
  name: 'PwaInstallPrompt',
  setup() {
    const { canInstall, showIosBanner, install, dismissIos } = usePwaInstall()

    return () => (
      <>
        {canInstall.value && (
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
              ),
            }}
          </v-banner>
        )}

        {showIosBanner.value && (
          <v-banner
            icon="mdi-apple"
            color="primary"
            lines="two"
            stacked={false}
            class="pwa-install-banner"
          >
            {{
              default: () => (
                <span class="text-body-2">
                  Для встановлення CRM натисніть
                  <v-icon size="small" class="mx-1">mdi-export-variant</v-icon>
                  (Поділитись) → <strong>«На початковий екран»</strong>
                </span>
              ),
              actions: () => (
                <v-btn
                  variant="text"
                  size="small"
                  class="text-none"
                  onClick={dismissIos}
                >
                  Зрозуміло
                </v-btn>
              ),
            }}
          </v-banner>
        )}
      </>
    )
  },
})
