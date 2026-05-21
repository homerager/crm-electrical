import { useToast, type ToastMessage } from '~/composables/useToast'

const TOAST_ICON: Record<string, string> = {
  success: 'mdi-check-circle',
  error: 'mdi-alert-circle',
  info: 'mdi-information',
  warning: 'mdi-alert',
}

/**
 * Хост глобальних toast-сповіщень. Монтується один раз у layout.
 * Читає чергу з `useToast()` і показує повідомлення по одному.
 */
export default defineComponent({
  name: 'AppToast',
  setup() {
    const { queue } = useToast()

    return () => (
      <v-snackbar-queue
        modelValue={queue.value}
        onUpdate:modelValue={(v: ToastMessage[]) => { queue.value = v }}
        location="top right"
        closable
        multi-line
      >
        {{
          text: ({ item }: { item: ToastMessage }) => (
            <div class="d-flex align-center">
              <v-icon class="mr-3">
                {TOAST_ICON[item?.color] ?? TOAST_ICON.info}
              </v-icon>
              <span>{item?.text}</span>
            </div>
          ),
        }}
      </v-snackbar-queue>
    )
  },
})
