/**
 * Web Push (PWA) підписка користувача.
 *
 * Працює поверх service worker, зареєстрованого vite-pwa. Підписка
 * прив'язується до пристрою (endpoint) і зберігається на сервері через
 * /api/push/subscribe. Сервер шле сповіщення з server/utils/webPush.ts.
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

// Shared reactive state across all consumers.
const isSupported = ref(false)
const permission = ref<NotificationPermission>('default')
const isSubscribed = ref(false)
const loading = ref(false)
let initialized = false

export function usePushNotifications() {
  const toast = useToast()
  const config = useRuntimeConfig()
  const vapidPublicKey = config.public.vapidPublicKey as string

  async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!isSupported.value) return null
    try {
      return (await navigator.serviceWorker.ready) ?? null
    } catch {
      return null
    }
  }

  async function refreshState() {
    if (!isSupported.value) return
    permission.value = Notification.permission
    const reg = await getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    isSubscribed.value = !!sub
  }

  function init() {
    if (import.meta.server || initialized) return
    initialized = true
    isSupported.value
      = 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window
    if (isSupported.value) {
      void refreshState()
    }
  }

  function notifyPermissionBlocked() {
    toast.warning(
      'Сповіщення заблоковані в браузері. Натисніть іконку замка в адресному рядку → Сповіщення → Дозволити, потім увімкніть знову.',
      8000,
    )
  }

  async function subscribe(): Promise<boolean> {
    if (!isSupported.value) {
      toast.warning('Цей браузер не підтримує push-сповіщення')
      return false
    }
    if (!vapidPublicKey) {
      toast.error('Push-сповіщення не налаштовані на сервері')
      return false
    }

    permission.value = Notification.permission
    if (permission.value === 'denied') {
      notifyPermissionBlocked()
      await refreshState()
      return false
    }

    loading.value = true
    try {
      const result = permission.value === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
      permission.value = result
      if (result !== 'granted') {
        toast.warning(
          result === 'denied'
            ? 'Ви відхилили сповіщення. Щоб увімкнути push, дозвольте їх у налаштуваннях сайту (іконка замка в адресному рядку).'
            : 'Дозвіл на сповіщення не надано',
          7000,
        )
        await refreshState()
        return false
      }

      const reg = await getRegistration()
      if (!reg) {
        toast.error('Service worker недоступний')
        return false
      }

      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        })
      }

      const json = sub.toJSON()
      await $fetch('/api/push/subscribe', {
        method: 'POST',
        body: {
          endpoint: sub.endpoint,
          keys: {
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
          },
        },
      })

      isSubscribed.value = true
      toast.success('Push-сповіщення увімкнено')
      return true
    } catch (e) {
      console.error('[Push] subscribe failed', e)
      toast.error('Не вдалося увімкнути push-сповіщення')
      await refreshState()
      return false
    } finally {
      loading.value = false
    }
  }

  async function unsubscribe(): Promise<boolean> {
    if (!isSupported.value) return false

    loading.value = true
    try {
      const reg = await getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await $fetch('/api/push/unsubscribe', {
          method: 'POST',
          body: { endpoint: sub.endpoint },
        }).catch(() => {})
        await sub.unsubscribe()
      }
      isSubscribed.value = false
      toast.info('Push-сповіщення вимкнено')
      return true
    } catch (e) {
      console.error('[Push] unsubscribe failed', e)
      toast.error('Не вдалося вимкнути push-сповіщення')
      return false
    } finally {
      loading.value = false
    }
  }

  async function toggle() {
    if (isSubscribed.value) {
      await unsubscribe()
    } else {
      await subscribe()
    }
  }

  init()

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    refreshState,
    subscribe,
    unsubscribe,
    toggle,
  }
}
