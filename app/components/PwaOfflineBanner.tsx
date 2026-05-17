export default defineComponent({
  name: 'PwaOfflineBanner',
  setup() {
    const { isOnline, wasOffline, dismissReconnected } = useNetworkStatus()
    const { queue, syncing, syncAll } = useOfflineQueue()

    const showReconnected = ref(false)

    watch(wasOffline, (val) => {
      if (val) {
        showReconnected.value = true
        syncAll()
        setTimeout(() => {
          showReconnected.value = false
          dismissReconnected()
        }, 5000)
      }
    })

    return () => (
      <>
        {!isOnline.value && (
          <v-banner
            icon="mdi-wifi-off"
            color="warning"
            lines="one"
            stacked={false}
            class="pwa-offline-banner"
          >
            {{
              default: () => (
                <span class="text-body-2">
                  Ви офлайн — дані з кешу. Зміни збережуться та синхронізуються автоматично.
                </span>
              ),
              actions: () =>
                queue.value.length > 0 ? (
                  <v-chip size="small" color="warning" variant="flat" prepend-icon="mdi-clock-outline">
                    {queue.value.length} в черзі
                  </v-chip>
                ) : null,
            }}
          </v-banner>
        )}

        {showReconnected.value && isOnline.value && (
          <v-banner
            icon="mdi-wifi-check"
            color="success"
            lines="one"
            stacked={false}
            class="pwa-offline-banner"
          >
            {{
              default: () => (
                <span class="text-body-2">
                  {syncing.value
                    ? `З'єднання відновлено. Синхронізація ${queue.value.length} дій...`
                    : 'З\'єднання відновлено. Все синхронізовано!'}
                </span>
              ),
              actions: () => (
                <v-btn
                  variant="text"
                  size="small"
                  icon="mdi-close"
                  onClick={() => {
                    showReconnected.value = false
                    dismissReconnected()
                  }}
                />
              ),
            }}
          </v-banner>
        )}

        {isOnline.value && !showReconnected.value && queue.value.length > 0 && (
          <v-banner
            icon="mdi-sync-alert"
            color="info"
            lines="one"
            stacked={false}
            class="pwa-offline-banner"
          >
            {{
              default: () => (
                <span class="text-body-2">
                  {syncing.value
                    ? `Синхронізація ${queue.value.length} дій...`
                    : `${queue.value.length} дій очікують синхронізації`}
                </span>
              ),
              actions: () =>
                !syncing.value ? (
                  <v-btn
                    variant="tonal"
                    size="small"
                    color="info"
                    prepend-icon="mdi-sync"
                    class="text-none"
                    onClick={() => syncAll()}
                  >
                    Синхронізувати
                  </v-btn>
                ) : (
                  <v-progress-circular indeterminate size={20} width={2} color="info" />
                ),
            }}
          </v-banner>
        )}
      </>
    )
  },
})
