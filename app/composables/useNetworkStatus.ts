export function useNetworkStatus() {
  const isOnline = ref(true)
  const wasOffline = ref(false)

  if (import.meta.client) {
    isOnline.value = navigator.onLine

    const setOnline = () => {
      if (!isOnline.value) wasOffline.value = true
      isOnline.value = true
    }
    const setOffline = () => {
      isOnline.value = false
    }

    onMounted(() => {
      window.addEventListener('online', setOnline)
      window.addEventListener('offline', setOffline)
    })

    onUnmounted(() => {
      window.removeEventListener('online', setOnline)
      window.removeEventListener('offline', setOffline)
    })
  }

  function dismissReconnected() {
    wasOffline.value = false
  }

  return { isOnline, wasOffline, dismissReconnected }
}
