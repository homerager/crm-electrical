export default defineComponent({
  name: 'ForgotPasswordPage',
  setup() {
    definePageMeta({ layout: 'auth', middleware: ['auth'] })

    useHead({ title: 'Відновлення паролю' })

    const email = ref('')
    const loading = ref(false)
    const error = ref('')
    const sent = ref(false)

    async function handleSubmit() {
      if (!email.value || loading.value) return
      error.value = ''
      loading.value = true
      try {
        await $fetch('/api/auth/forgot-password', {
          method: 'POST',
          body: { email: email.value },
        })
        sent.value = true
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка надсилання запиту'
      } finally {
        loading.value = false
      }
    }

    return () => (
      <v-card rounded="xl" elevation={12}>
        <v-card-text class="pa-6 pa-sm-8">
          <div class="text-h6 font-weight-bold text-center">
            Відновлення паролю
          </div>

          {sent.value
            ? (
              <>
                <v-alert
                  type="success"
                  variant="tonal"
                  density="comfortable"
                  class="mt-6"
                  icon="mdi-email-check-outline"
                >
                  Якщо обліковий запис із такою адресою існує, ми надіслали на нього
                  посилання для скидання паролю. Перевірте поштову скриньку.
                </v-alert>
                <v-btn
                  block
                  variant="flat"
                  color="primary"
                  size="large"
                  class="mt-5"
                  to="/login"
                  prepend-icon="mdi-arrow-left"
                >
                  Повернутися до входу
                </v-btn>
              </>
            )
            : (
              <>
                <div class="text-body-2 text-medium-emphasis text-center mt-1 mb-6">
                  Введіть email — ми надішлемо посилання для скидання паролю
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
                  v-model={email.value}
                  label="Email"
                  type="email"
                  prepend-inner-icon="mdi-email-outline"
                  autocomplete="email"
                  onKeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleSubmit()}
                />

                <v-btn
                  block
                  variant="flat"
                  color="primary"
                  size="large"
                  class="mt-3"
                  prepend-icon="mdi-email-fast-outline"
                  loading={loading.value}
                  disabled={!email.value}
                  onClick={handleSubmit}
                >
                  Надіслати посилання
                </v-btn>

                <div class="text-center mt-4">
                  <nuxt-link
                    to="/login"
                    class="text-caption text-primary text-decoration-none"
                  >
                    Повернутися до входу
                  </nuxt-link>
                </div>
              </>
            )}
        </v-card-text>
      </v-card>
    )
  },
})
