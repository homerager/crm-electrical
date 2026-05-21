export default defineComponent({
  name: 'ChangePasswordDialog',
  props: {
    modelValue: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const MIN_LEN = 8
    const toast = useToast()

    const currentPassword = ref('')
    const newPassword = ref('')
    const confirm = ref('')
    const showCurrent = ref(false)
    const showNew = ref(false)
    const loading = ref(false)
    const error = ref('')
    const success = ref(false)

    const open = computed({
      get: () => props.modelValue,
      set: (v: boolean) => emit('update:modelValue', v),
    })

    const mismatch = computed(
      () => confirm.value.length > 0 && newPassword.value !== confirm.value,
    )
    const canSubmit = computed(
      () =>
        currentPassword.value.length > 0
        && newPassword.value.length >= MIN_LEN
        && newPassword.value === confirm.value,
    )

    function reset() {
      currentPassword.value = ''
      newPassword.value = ''
      confirm.value = ''
      showCurrent.value = false
      showNew.value = false
      error.value = ''
      success.value = false
      loading.value = false
    }

    watch(open, (v) => {
      if (v) reset()
    })

    async function handleSubmit() {
      if (!canSubmit.value || loading.value) return
      error.value = ''
      loading.value = true
      try {
        await $fetch('/api/auth/change-password', {
          method: 'POST',
          body: {
            currentPassword: currentPassword.value,
            newPassword: newPassword.value,
          },
        })
        success.value = true
        toast.success('Пароль змінено')
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Не вдалося змінити пароль'
        toast.error(error.value)
      } finally {
        loading.value = false
      }
    }

    const eyeSlot = (shown: { value: boolean }) => ({
      'append-inner': () => (
        <v-btn
          type="button"
          icon={shown.value ? 'mdi-eye-off' : 'mdi-eye'}
          variant="text"
          size="small"
          tabindex={-1}
          onMousedown={(e: MouseEvent) => e.preventDefault()}
          onClick={(e: MouseEvent) => {
            e.stopPropagation()
            shown.value = !shown.value
          }}
        />
      ),
    })

    return () => (
      <v-dialog v-model={open.value} max-width={460} persistent={loading.value}>
        <v-card>
          <v-card-title class="pa-4 d-flex align-center" style="gap:8px">
            <v-icon color="primary">mdi-lock-reset</v-icon>
            Зміна паролю
          </v-card-title>
          <v-card-text class="pa-4 pt-0">
            {success.value
              ? (
                <v-alert
                  type="success"
                  variant="tonal"
                  density="comfortable"
                  icon="mdi-lock-check-outline"
                >
                  Пароль успішно змінено.
                </v-alert>
              )
              : (
                <>
                  {error.value && (
                    <v-alert
                      type="error"
                      variant="tonal"
                      density="compact"
                      class="mb-4"
                      closable
                      onUpdate:modelValue={() => (error.value = '')}
                    >
                      {error.value}
                    </v-alert>
                  )}

                  <v-text-field
                    v-model={currentPassword.value}
                    label="Поточний пароль"
                    type={showCurrent.value ? 'text' : 'password'}
                    prepend-inner-icon="mdi-lock-outline"
                    autocomplete="current-password"
                    class="mb-3"
                  >
                    {eyeSlot(showCurrent)}
                  </v-text-field>

                  <v-text-field
                    v-model={newPassword.value}
                    label="Новий пароль"
                    type={showNew.value ? 'text' : 'password'}
                    prepend-inner-icon="mdi-lock-plus-outline"
                    autocomplete="new-password"
                    class="mb-3"
                    hint={`Щонайменше ${MIN_LEN} символів`}
                    persistent-hint
                  >
                    {eyeSlot(showNew)}
                  </v-text-field>

                  <v-text-field
                    v-model={confirm.value}
                    label="Повторіть новий пароль"
                    type={showNew.value ? 'text' : 'password'}
                    prepend-inner-icon="mdi-lock-check-outline"
                    autocomplete="new-password"
                    error={mismatch.value}
                    error-messages={mismatch.value ? 'Паролі не співпадають' : undefined}
                    onKeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleSubmit()}
                  />
                </>
              )}
          </v-card-text>
          <v-card-actions class="pa-4 pt-0">
            <v-spacer />
            {success.value
              ? (
                <v-btn color="primary" variant="elevated" onClick={() => (open.value = false)}>
                  Закрити
                </v-btn>
              )
              : (
                <>
                  <v-btn
                    variant="outlined"
                    disabled={loading.value}
                    onClick={() => (open.value = false)}
                  >
                    Скасувати
                  </v-btn>
                  <v-btn
                    color="primary"
                    variant="elevated"
                    loading={loading.value}
                    disabled={!canSubmit.value}
                    onClick={handleSubmit}
                  >
                    Змінити
                  </v-btn>
                </>
              )}
          </v-card-actions>
        </v-card>
      </v-dialog>
    )
  },
})
