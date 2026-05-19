type TaskSSEHandler = {
  onCreated?: (task: any) => void
  onUpdated?: (task: any) => void
  onDeleted?: (data: { id: string }) => void
}

const handlers = new Set<TaskSSEHandler>()

let listening = false

export function useTasksRealtime(handler?: TaskSSEHandler) {
  if (handler) {
    onMounted(() => { handlers.add(handler) })
    onUnmounted(() => { handlers.delete(handler) })
  }

  function startListening() {
    if (import.meta.server || listening) return
    listening = true
  }

  return { startListening }
}

export function dispatchTaskSSE(event: string, data: unknown) {
  for (const h of handlers) {
    if (event === 'task-created' && h.onCreated) h.onCreated(data)
    if (event === 'task-updated' && h.onUpdated) h.onUpdated(data)
    if (event === 'task-deleted' && h.onDeleted) h.onDeleted(data as { id: string })
  }
}
