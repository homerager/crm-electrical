interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const canInstall = ref(false)
const isInstalled = ref(false)
const isIos = ref(false)
const showIosGuide = ref(false)
let deferredPrompt: BeforeInstallPromptEvent | null = null
let initialized = false

export function usePwaInstall() {
  if (import.meta.client && !initialized) {
    initialized = true
    const ua = navigator.userAgent
    isIos.value = /iphone|ipad|ipod/i.test(ua)

    isInstalled.value = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt = e as BeforeInstallPromptEvent
      canInstall.value = true
    })

    window.addEventListener('appinstalled', () => {
      canInstall.value = false
      isInstalled.value = true
      deferredPrompt = null
    })
  }

  async function install() {
    if (isIos.value && !isInstalled.value) {
      showIosGuide.value = true
      return
    }
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      canInstall.value = false
      isInstalled.value = true
    }
    deferredPrompt = null
  }

  const showInstallOption = computed(
    () => !isInstalled.value && (canInstall.value || isIos.value),
  )

  return {
    canInstall,
    isInstalled,
    isIos,
    showInstallOption,
    showIosGuide,
    install,
  }
}
