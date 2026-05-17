import { get, set, del, keys, entries } from 'idb-keyval'

export interface QueuedAction {
  id: string
  url: string
  method: 'POST' | 'PUT' | 'DELETE'
  body?: Record<string, unknown> | null
  /** Base64-encoded files keyed by field name */
  files?: Record<string, { name: string; type: string; data: string }>
  createdAt: number
  description: string
  retries: number
}

const QUEUE_PREFIX = 'offline-queue:'

function queueKey(id: string) {
  return `${QUEUE_PREFIX}${id}`
}

export function useOfflineQueue() {
  const queue = ref<QueuedAction[]>([])
  const syncing = ref(false)

  async function load() {
    if (import.meta.server) return
    const allKeys = await keys<string>()
    const queueKeys = allKeys.filter((k) => typeof k === 'string' && k.startsWith(QUEUE_PREFIX))
    const items: QueuedAction[] = []
    for (const key of queueKeys) {
      const val = await get<QueuedAction>(key)
      if (val) items.push(val)
    }
    items.sort((a, b) => a.createdAt - b.createdAt)
    queue.value = items
  }

  async function enqueue(action: Omit<QueuedAction, 'id' | 'createdAt' | 'retries'>) {
    const item: QueuedAction = {
      ...action,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      retries: 0,
    }
    await set(queueKey(item.id), item)
    queue.value.push(item)
    return item
  }

  async function remove(id: string) {
    await del(queueKey(id))
    queue.value = queue.value.filter((i) => i.id !== id)
  }

  async function syncAll() {
    if (syncing.value || !navigator.onLine) return
    syncing.value = true

    try {
      const snapshot = [...queue.value]
      for (const action of snapshot) {
        try {
          if (action.files && Object.keys(action.files).length > 0) {
            const formData = new FormData()
            for (const [field, file] of Object.entries(action.files)) {
              const binary = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0))
              const blob = new Blob([binary], { type: file.type })
              formData.append(field, blob, file.name)
            }
            if (action.body) {
              for (const [key, val] of Object.entries(action.body)) {
                formData.append(key, String(val))
              }
            }
            await $fetch(action.url, { method: action.method, body: formData })
          } else {
            await $fetch(action.url, { method: action.method, body: action.body })
          }
          await remove(action.id)
        } catch (err) {
          console.warn(`[OfflineQueue] Failed to sync action ${action.id}:`, err)
          action.retries++
          await set(queueKey(action.id), action)
        }
      }
    } finally {
      syncing.value = false
      await load()
    }
  }

  if (import.meta.client) {
    onMounted(() => {
      load()
      window.addEventListener('online', () => syncAll())
    })
  }

  return { queue, syncing, load, enqueue, remove, syncAll }
}
