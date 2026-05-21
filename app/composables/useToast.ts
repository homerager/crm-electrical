export type ToastColor = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  /** Текст повідомлення — поле, яке очікує `<v-snackbar-queue>`. */
  text: string
  /** Тип тоста — впливає на колір та іконку. */
  color: ToastColor
  /** Тривалість показу, мс. */
  timeout: number
}

const DEFAULT_TIMEOUT: Record<ToastColor, number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  error: 6000,
}

/**
 * Глобальні toast-сповіщення поверх інтерфейсу.
 * Повідомлення складаються у чергу та показуються по одному
 * через `<v-snackbar-queue>` у компоненті `AppToast`, який змонтований у layout.
 *
 * Приклад:
 *   const toast = useToast()
 *   toast.success('Клієнта створено')
 *   toast.error('Помилка збереження')
 */
export function useToast() {
  const queue = useState<ToastMessage[]>('app-toast-queue', () => [])

  function push(text: string, color: ToastColor, timeout?: number) {
    if (import.meta.server || !text) return
    queue.value = [...queue.value, { text, color, timeout: timeout ?? DEFAULT_TIMEOUT[color] }]
  }

  return {
    queue,
    show: push,
    success: (text: string, timeout?: number) => push(text, 'success', timeout),
    error: (text: string, timeout?: number) => push(text, 'error', timeout),
    info: (text: string, timeout?: number) => push(text, 'info', timeout),
    warning: (text: string, timeout?: number) => push(text, 'warning', timeout),
  }
}
