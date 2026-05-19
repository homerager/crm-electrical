export interface AppNotification {
  id: string
  userId: string
  title: string
  body: string | null
  link: string | null
  isRead: boolean
  createdAt: string
}

interface NotificationsResponse {
  items: AppNotification[]
  total: number
  unreadCount: number
  page: number
  limit: number
}

const POLL_INTERVAL = 30_000
const SSE_RECONNECT_DELAY = 3_000

// Module-level state shared across all composable consumers
let pollTimer: ReturnType<typeof setInterval> | null = null
let eventSource: EventSource | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let sseActive = false

export function useNotifications() {
  const items = useState<AppNotification[]>('notifications-items', () => [])
  const unreadCount = useState<number>('notifications-unread', () => 0)
  const loading = useState<boolean>('notifications-loading', () => false)
  const total = useState<number>('notifications-total', () => 0)

  async function fetchNotifications(page = 1) {
    loading.value = true
    try {
      const data = await $fetch<NotificationsResponse>('/api/notifications', {
        params: { page, limit: 20 },
      })
      items.value = data.items
      unreadCount.value = data.unreadCount
      total.value = data.total
    } catch {
      // silently fail
    } finally {
      loading.value = false
    }
  }

  async function fetchUnreadCount() {
    try {
      const data = await $fetch<{ count: number }>('/api/notifications/unread-count')
      unreadCount.value = data.count
    } catch {
      // silently fail
    }
  }

  async function markAsRead(id: string) {
    try {
      await $fetch(`/api/notifications/${id}`, {
        method: 'PUT',
        body: { isRead: true },
      })
      const item = items.value.find((n) => n.id === id)
      if (item && !item.isRead) {
        item.isRead = true
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
    } catch {
      // silently fail
    }
  }

  async function markAllAsRead() {
    try {
      await $fetch('/api/notifications/read-all', { method: 'PUT' })
      items.value.forEach((n) => { n.isRead = true })
      unreadCount.value = 0
    } catch {
      // silently fail
    }
  }

  async function remove(id: string) {
    try {
      await $fetch(`/api/notifications/${id}`, { method: 'DELETE' })
      const idx = items.value.findIndex((n) => n.id === id)
      if (idx !== -1) {
        const removed = items.value[idx]!
        items.value.splice(idx, 1)
        total.value = Math.max(0, total.value - 1)
        if (!removed.isRead) {
          unreadCount.value = Math.max(0, unreadCount.value - 1)
        }
      }
    } catch {
      // silently fail
    }
  }

  function connectSSE() {
    if (import.meta.server) return
    if (eventSource) return

    try {
      eventSource = new EventSource('/api/notifications/stream')

      eventSource.addEventListener('notification', (e) => {
        try {
          const notification: AppNotification = JSON.parse(e.data)
          items.value.unshift(notification)
          total.value += 1
          if (!notification.isRead) {
            unreadCount.value += 1
          }
        } catch {
          // ignore parse errors
        }
      })

      eventSource.addEventListener('unread-count', (e) => {
        try {
          const data = JSON.parse(e.data)
          unreadCount.value = data.count
        } catch {
          // ignore
        }
      })

      // Task real-time events
      eventSource.addEventListener('task-created', (e) => {
        try { dispatchTaskSSE('task-created', JSON.parse(e.data)) } catch {}
      })
      eventSource.addEventListener('task-updated', (e) => {
        try { dispatchTaskSSE('task-updated', JSON.parse(e.data)) } catch {}
      })
      eventSource.addEventListener('task-deleted', (e) => {
        try { dispatchTaskSSE('task-deleted', JSON.parse(e.data)) } catch {}
      })

      eventSource.addEventListener('connected', () => {
        sseActive = true
        stopPolling()
      })

      eventSource.onerror = () => {
        closeSSE()
        sseActive = false
        scheduleReconnect()
      }
    } catch {
      sseActive = false
      startPolling()
    }
  }

  function closeSSE() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return
    // Resume polling while SSE is disconnected
    if (!pollTimer) startPolling()
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connectSSE()
    }, SSE_RECONNECT_DELAY)
  }

  function startPolling() {
    if (import.meta.server || pollTimer) return
    fetchUnreadCount()
    pollTimer = setInterval(fetchUnreadCount, POLL_INTERVAL)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function startRealtime() {
    if (import.meta.server) return
    if (sseActive && eventSource) return
    connectSSE()
    // Start polling as temporary fallback — will be stopped when SSE connects
    if (!sseActive && !pollTimer) {
      startPolling()
    }
  }

  function stopRealtime() {
    closeSSE()
    stopPolling()
    sseActive = false
  }

  return {
    items,
    unreadCount,
    loading,
    total,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    remove,
    startPolling,
    stopPolling,
    startRealtime,
    stopRealtime,
  }
}
