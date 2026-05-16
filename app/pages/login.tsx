export default defineComponent({
  name: 'LoginPage',
  setup() {
    definePageMeta({ layout: 'auth', middleware: ['auth'] })
    
    useHead({
      title: "Логін"
    })

    const { login } = useAuth()
    const router = useRouter()

    const form = reactive({ email: '', password: '' })
    const loading = ref(false)
    const error = ref('')
    const showPassword = ref(false)

    async function handleSubmit() {
      error.value = ''
      loading.value = true
      try {
        await login(form.email, form.password)
        await router.push('/')
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка входу'
      } finally {
        loading.value = false
      }
    }

    return () => (
      <v-card rounded="xl" elevation={12}>
        <v-card-text class="pa-6 pa-sm-8">
          <div class="text-h6 font-weight-bold text-center">
            Вхід в систему
          </div>
          <div class="text-body-2 text-medium-emphasis text-center mt-1 mb-6">
            Введіть дані облікового запису
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
            v-model={form.email}
            label="Email"
            type="email"
            prepend-inner-icon="mdi-email-outline"
            autocomplete="email"
            class="mb-3"
            onKeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleSubmit()}
          />
          <v-text-field
            v-model={form.password}
            label="Пароль"
            type={showPassword.value ? 'text' : 'password'}
            prepend-inner-icon="mdi-lock-outline"
            autocomplete="current-password"
            onKeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleSubmit()}
          >
            {{
              'append-inner': () => (
                <v-btn
                  type="button"
                  icon={showPassword.value ? 'mdi-eye-off' : 'mdi-eye'}
                  variant="text"
                  size="small"
                  tabindex={-1}
                  aria-pressed={showPassword.value}
                  aria-label={showPassword.value ? 'Сховати пароль' : 'Показати пароль'}
                  onMousedown={(e: MouseEvent) => e.preventDefault()}
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation()
                    showPassword.value = !showPassword.value
                  }}
                />
              ),
            }}
          </v-text-field>

          <v-btn
            block
            variant="flat"
            color="primary"
            size="large"
            class="mt-5"
            prepend-icon="mdi-login-variant"
            loading={loading.value}
            disabled={!form.email || !form.password}
            onClick={handleSubmit}
          >
            Увійти
          </v-btn>
        </v-card-text>
      </v-card>
    )
  },
})
