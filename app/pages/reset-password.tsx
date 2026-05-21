export default defineComponent({
  name: 'ResetPasswordPage',
  setup() {
    definePageMeta({ layout: 'auth', middleware: ['auth'] })

    useHead({ title: 'Новий пароль' })

    const route = useRoute()
    const token = computed(() => String(route.query.token ?? ''))

    const checking = ref(true)
    const tokenValid = ref(false)
    const tokenEmail = ref('')

    const password = ref('')
    const confirm = ref('')
    const showPassword = ref(false)
    const loading = ref(false)
    const error = ref('')
    const done = ref(false)

    const MIN_LEN = 8
    const mismatch = computed(
      () => confirm.value.length > 0 && password.value !== confirm.value,
    )
    const canSubmit = computed(
      () => password.value.length >= MIN_LEN && password.value === confirm.value,
    )

    async function validateToken() {
      checking.value = true
      if (!token.value) {
        tokenValid.value = false
        checking.value = false
        return
      }
      try {
        const res = await $fetch<{ valid: boolean; email?: string }>(
          '/api/auth/reset-password',
          { query: { token: token.value } },
        )
        tokenValid.value = res.valid
        tokenEmail.value = res.email ?? ''
      } catch {
        tokenValid.value = false
      } finally {
        checking.value = false
      }
    }

    onMounted(validateToken)

    async function handleSubmit() {
      if (!canSubmit.value || loading.value) return
      error.value = ''
      loading.value = true
      try {
        await $fetch('/api/auth/reset-password', {
          method: 'POST',
          body: { token: token.value, password: password.value },
        })
        done.value = true
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Не вдалося змінити пароль'
      } finally {
        loading.value = false
      }
    }

    return () => (
      <v-card rounded="xl" elevation={12}>
        <v-card-text class="pa-6 pa-sm-8">
          <div class="text-h6 font-weight-bold text-center">
            Новий пароль
          </div>

          {checking.value && (
            <div class="text-center py-8">
              <v-progress-circular indeterminate color="primary" />
            </div>
          )}

          {!checking.value && done.value && (
            <>
              <v-alert
                type="success"
                variant="tonal"
                density="comfortable"
                class="mt-6"
                icon="mdi-lock-check-outline"
              >
                Пароль успішно змінено. Тепер ви можете увійти з новим паролем.
              </v-alert>
              <v-btn
                block
                variant="flat"
                color="primary"
                size="large"
                class="mt-5"
                to="/login"
                prepend-icon="mdi-login-variant"
              >
                Увійти
              </v-btn>
            </>
          )}

          {!checking.value && !done.value && !tokenValid.value && (
            <>
              <v-alert
                type="error"
                variant="tonal"
                density="comfortable"
                class="mt-6"
                icon="mdi-link-variant-off"
              >
                Посилання недійсне або термін його дії минув. Запросіть нове
                посилання для відновлення паролю.
              </v-alert>
              <v-btn
                block
                variant="flat"
                color="primary"
                size="large"
                class="mt-5"
                to="/forgot-password"
                prepend-icon="mdi-email-fast-outline"
              >
                Запросити нове посилання
              </v-btn>
            </>
          )}

          {!checking.value && !done.value && tokenValid.value && (
            <>
              <div class="text-body-2 text-medium-emphasis text-center mt-1 mb-6">
                {tokenEmail.value
                  ? `Встановіть новий пароль для ${tokenEmail.value}`
                  : 'Встановіть новий пароль'}
              </div>

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
                v-model={password.value}
                label="Новий пароль"
                type={showPassword.value ? 'text' : 'password'}
                prepend-inner-icon="mdi-lock-outline"
                autocomplete="new-password"
                class="mb-3"
                hint={`Щонайменше ${MIN_LEN} символів`}
                persistent-hint
              >
                {{
                  'append-inner': () => (
                    <v-btn
                      type="button"
                      icon={showPassword.value ? 'mdi-eye-off' : 'mdi-eye'}
                      variant="text"
                      size="small"
                      tabindex={-1}
                      onMousedown={(e: MouseEvent) => e.preventDefault()}
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation()
                        showPassword.value = !showPassword.value
                      }}
                    />
                  ),
                }}
              </v-text-field>

              <v-text-field
                v-model={confirm.value}
                label="Повторіть пароль"
                type={showPassword.value ? 'text' : 'password'}
                prepend-inner-icon="mdi-lock-check-outline"
                autocomplete="new-password"
                error={mismatch.value}
                error-messages={mismatch.value ? 'Паролі не співпадають' : undefined}
                onKeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleSubmit()}
              />

              <v-btn
                block
                variant="flat"
                color="primary"
                size="large"
                class="mt-3"
                prepend-icon="mdi-content-save-check-outline"
                loading={loading.value}
                disabled={!canSubmit.value}
                onClick={handleSubmit}
              >
                Зберегти пароль
              </v-btn>
            </>
          )}
        </v-card-text>
      </v-card>
    )
  },
})
