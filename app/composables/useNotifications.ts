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

export function useNotifications() {
  const items = useState<AppNotification[]>('notifications-items', () => [])
  const unreadCount = useState<number>('notifications-unread', () => 0)
  const loading = useState<boolean>('notifications-loading', () => false)
  const total = useState<number>('notifications-total', () => 0)

  let pollTimer: ReturnType<typeof setInterval> | null = null

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
        const removed = items.value[idx]
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
  }
}
