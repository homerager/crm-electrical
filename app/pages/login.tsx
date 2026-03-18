export default defineComponent({
  name: 'LoginPage',
  setup() {
    definePageMeta({ layout: 'auth', middleware: ['auth'] })

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
      <v-card class="pa-2">
        <v-card-title class="text-h6 text-center pa-4">
          Вхід в систему
        </v-card-title>
        <v-card-text>
          {error.value && (
            <v-alert type="error" variant="tonal" class="mb-4" closable onUpdate:modelValue={() => (error.value = '')}>
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
            append-inner-icon={showPassword.value ? 'mdi-eye-off' : 'mdi-eye'}
            onClickAppendInner={() => (showPassword.value = !showPassword.value)}
            autocomplete="current-password"
            onKeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleSubmit()}
          />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-btn
            block
            color="primary"
            size="large"
            loading={loading.value}
            disabled={!form.email || !form.password}
            onClick={handleSubmit}
          >
            Увійти
          </v-btn>
        </v-card-actions>
      </v-card>
    )
  },
})
