const BOT_URL = 'https://t.me/proelectric_crm_bot'

export default defineComponent({
  name: 'TelegramConnectDialog',
  props: {
    modelValue: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const toast = useToast()

    const phone = ref('')
    const connected = ref(false)
    const loading = ref(false)
    const saving = ref(false)
    const error = ref('')

    const open = computed({
      get: () => props.modelValue,
      set: (v: boolean) => emit('update:modelValue', v),
    })

    async function load() {
      loading.value = true
      error.value = ''
      try {
        const { user } = await $fetch<{ user: { phone: string | null; telegramChatId: string | null } }>('/api/auth/me')
        phone.value = user.phone ?? ''
        connected.value = !!user.telegramChatId
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Не вдалося завантажити дані'
      } finally {
        loading.value = false
      }
    }

    watch(open, (v) => {
      if (v) load()
    })

    async function savePhone() {
      if (saving.value || !phone.value.trim()) return
      saving.value = true
      error.value = ''
      try {
        await $fetch('/api/auth/me', { method: 'PUT', body: { phone: phone.value.trim() } })
        toast.success('Номер збережено')
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Не вдалося зберегти номер'
        toast.error(error.value)
      } finally {
        saving.value = false
      }
    }

    return () => (
      <v-dialog v-model={open.value} max-width={580}>
        <v-card>
          <v-card-title class="pa-4 d-flex align-center" style="gap:8px">
            <v-icon color="primary">mdi-send-circle</v-icon>
            Telegram сповіщення
          </v-card-title>
          <v-card-text class="pa-4 pt-0">
            {loading.value
              ? (
                <div class="d-flex justify-center py-6">
                  <v-progress-circular indeterminate size={28} />
                </div>
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

                  <div class="mb-4">
                    {connected.value
                      ? (
                        <v-chip color="success" variant="tonal" prepend-icon="mdi-send-check">
                          Підключено
                        </v-chip>
                      )
                      : (
                        <v-chip color="grey" variant="tonal" prepend-icon="mdi-send-clock-outline">
                          Не підключено
                        </v-chip>
                      )}
                  </div>

                  <div class="text-body-2 text-medium-emphasis mb-4">
                    <span class="font-weight-medium">Крок 1:</span> Збережіть свій номер телефону у форматі <code>+380...</code><br />
                    <span class="font-weight-medium">Крок 2:</span> Відкрийте бота і надішліть <code>/start</code> → натисніть «Поділитися номером»<br />
                    <span class="font-weight-medium">Крок 3:</span> Статус зміниться на «Підключено» — сповіщення активовані
                  </div>

                  <div class="d-flex align-start gap-2">
                    <v-text-field
                      v-model={phone.value}
                      label="Номер телефону"
                      placeholder="+380..."
                      prepend-inner-icon="mdi-phone-outline"
                      density="comfortable"
                      hint="Має збігатися з номером вашого Telegram"
                      persistent-hint
                      onKeydown={(e: KeyboardEvent) => e.key === 'Enter' && savePhone()}
                    />
                    <v-btn
                      color="primary"
                      variant="elevated"
                      class="mt-1"
                      loading={saving.value}
                      disabled={!phone.value.trim()}
                      onClick={savePhone}
                    >
                      Зберегти
                    </v-btn>
                  </div>
                </>
              )}
          </v-card-text>
          <v-card-actions class="pa-4 pt-0">
            <v-btn
              href={BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              color="primary"
              variant="tonal"
              prepend-icon="mdi-send"
            >
              Відкрити бота
            </v-btn>
            <v-spacer />
            <v-btn
              variant="flat"
              color="primary"
              prepend-icon="mdi-refresh"
              loading={loading.value}
              onClick={load}
            >
              Оновити статус
            </v-btn>
            <v-btn variant="outlined" onClick={() => (open.value = false)}>
              Закрити
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    )
  },
})
