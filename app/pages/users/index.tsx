export default defineComponent({
  name: 'UsersPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Користувачі' })

    const { isAdmin, user: currentUser } = useAuth()
    const router = useRouter()

    if (!isAdmin.value) {
      router.push('/')
    }

    const { data, refresh, pending } = useFetch('/api/users')
    const users = computed(() => (data.value as any)?.users ?? [])

    const { data: jobTitlesData, refresh: refreshJobTitles } = useFetch('/api/job-titles')
    const jobTitleItems = computed(() => (jobTitlesData.value as any)?.jobTitles ?? [])

    const createDialog = ref(false)
    const editDialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const editItem = ref<any>(null)

    const createForm = reactive({
      name: '',
      email: '',
      password: '',
      role: 'STOREKEEPER',
      phone: '',
      jobTitleId: null as string | null,
    })
    const editForm = reactive({
      name: '',
      role: 'STOREKEEPER',
      isActive: true,
      phone: '',
      jobTitleId: null as string | null,
    })

    const webhookLoading = ref(false)
    const webhookStatus = ref<{ ok: boolean; msg: string } | null>(null)

    async function setupWebhook() {
      webhookLoading.value = true
      webhookStatus.value = null
      try {
        const res = await $fetch<any>('/api/telegram/setup-webhook', { method: 'POST' })
        webhookStatus.value = { ok: true, msg: `Webhook зареєстровано: ${res.webhookUrl}` }
      } catch (e: any) {
        webhookStatus.value = { ok: false, msg: e?.data?.statusMessage || 'Помилка реєстрації webhook' }
      } finally {
        webhookLoading.value = false
      }
    }

    const roleOptions = [
      { title: 'Адміністратор', value: 'ADMIN' },
      { title: 'Менеджер', value: 'MANAGER' },
      { title: 'Комірник', value: 'STOREKEEPER' },
      { title: 'Користувач', value: 'USER' },
    ]

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(editForm, {
        name: item.name,
        role: item.role,
        isActive: item.isActive,
        phone: item.phone ?? '',
        jobTitleId: item.jobTitleId ?? null,
      })
      error.value = ''
      editDialog.value = true
    }

    async function createUser() {
      saving.value = true
      error.value = ''
      try {
        await $fetch('/api/auth/register', {
          method: 'POST',
          body: {
            name: createForm.name,
            email: createForm.email,
            password: createForm.password,
            role: createForm.role,
            phone: createForm.phone,
            jobTitleId: createForm.jobTitleId || undefined,
          },
        })
        createDialog.value = false
        Object.assign(createForm, {
          name: '',
          email: '',
          password: '',
          role: 'STOREKEEPER',
          phone: '',
          jobTitleId: null,
        })
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка створення'
      } finally {
        saving.value = false
      }
    }

    async function saveEdit() {
      if (!editItem.value) return
      saving.value = true
      error.value = ''
      try {
        await $fetch(`/api/users/${editItem.value.id}`, {
          method: 'PUT',
          body: {
            name: editForm.name,
            role: editForm.role,
            isActive: editForm.isActive,
            phone: editForm.phone,
            jobTitleId: editForm.jobTitleId || null,
          },
        })
        editDialog.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        saving.value = false
      }
    }

    async function toggleActive(item: any) {
      await $fetch(`/api/users/${item.id}`, {
        method: 'PUT',
        body: { isActive: !item.isActive },
      })
      await refresh()
    }

    const headers = [
      { title: 'Імʼя', key: 'name' },
      { title: 'Email', key: 'email' },
      { title: 'Телефон', key: 'phone', width: 160 },
      { title: 'Telegram', key: 'telegram', width: 130 },
      { title: 'Роль', key: 'role', width: 160 },
      { title: 'Посада', key: 'jobTitle', width: 180 },
      { title: 'Статус', key: 'isActive', width: 120 },
      { title: 'Реєстрація', key: 'createdAt', width: 140 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 100 },
    ]

    return () => (
      <div>
        <div class="d-flex align-center mb-4">
          <div class="text-h5 font-weight-bold">Користувачі</div>
          <v-spacer />
          <v-btn
            color="primary"
            prepend-icon="mdi-account-plus"
            onClick={() => {
              error.value = ''
              refreshJobTitles()
              createDialog.value = true
            }}
          >
            Додати користувача
          </v-btn>
        </div>

        {/* Telegram setup card */}
        <v-card class="mb-4" variant="outlined">
          <v-card-text class="pa-4">
            <div class="d-flex align-center gap-3 flex-wrap">
              <v-icon color="primary" size="28">mdi-send-circle</v-icon>
              <div style="flex:1; min-width:220px">
                <div class="text-subtitle-2 font-weight-bold mb-1">Telegram сповіщення</div>
                <div class="text-body-2 text-medium-emphasis mb-2">
                  <span class="font-weight-medium">Крок 1:</span> Додайте номер телефону юзеру у форматі <code>+380...</code><br />
                  <span class="font-weight-medium">Крок 2:</span> Юзер відкриває бота і надсилає <code>/start</code> → натискає «Поділитися номером»<br />
                  <span class="font-weight-medium">Крок 3:</span> Статус змінюється на «Підключено» — сповіщення активовані
                </div>
                <div class="d-flex align-center gap-2 flex-wrap">
                  <v-btn
                    href="https://t.me/proelectric_crm_bot"
                    target="_blank"
                    color="primary"
                    variant="tonal"
                    size="small"
                    prepend-icon="mdi-send"
                  >
                    Відкрити бота
                  </v-btn>
                  {/*<v-btn
                    color="secondary"
                    variant="outlined"
                    size="small"
                    prepend-icon="mdi-webhook"
                    loading={webhookLoading.value}
                    onClick={setupWebhook}
                  >
                    Зареєструвати webhook
                  </v-btn> */}
                </div>
                {webhookStatus.value && (
                  <v-alert
                    type={webhookStatus.value.ok ? 'success' : 'error'}
                    variant="tonal"
                    density="compact"
                    class="mt-2"
                    closable
                    onMousedown={() => (webhookStatus.value = null)}
                  >
                    {webhookStatus.value.msg}
                  </v-alert>
                )}
              </div>
            </div>
          </v-card-text>
        </v-card>

        <v-card>
          <v-data-table headers={headers} items={users.value} loading={pending.value} hover>
            {{
              'item.phone': ({ item }: any) => (
                <span class={item.phone ? '' : 'text-disabled'}>
                  {item.phone || '—'}
                </span>
              ),
              'item.telegram': ({ item }: any) => (
                item.telegramChatId
                  ? <v-chip size="small" color="success" variant="tonal" prepend-icon="mdi-send-check">Підключено</v-chip>
                  : (
                    <v-tooltip text="Відкрити бота і надіслати /start">
                      {{
                        activator: ({ props }: any) => (
                          <v-chip
                            {...props}
                            size="small"
                            color="warning"
                            variant="tonal"
                            prepend-icon="mdi-send-clock"
                            href="https://t.me/proelectric_crm_bot"
                            target="_blank"
                            link
                          >
                            Підключити
                          </v-chip>
                        ),
                      }}
                    </v-tooltip>
                  )
              ),
              'item.jobTitle': ({ item }: any) => (
                <span class={item.jobTitle?.name ? '' : 'text-disabled'}>
                  {item.jobTitle?.name ?? '—'}
                </span>
              ),
              'item.role': ({ item }: any) => {
                const r = item.role as string
                const isAdminR = r === 'ADMIN'
                const isManagerR = r === 'MANAGER'
                const isUserR = r === 'USER'
                const label = isAdminR
                  ? 'Адміністратор'
                  : isManagerR
                    ? 'Менеджер'
                    : isUserR
                      ? 'Користувач'
                      : 'Комірник'
                const icon = isAdminR
                  ? 'mdi-shield-account'
                  : isManagerR
                    ? 'mdi-account-tie'
                    : isUserR
                      ? 'mdi-account'
                      : 'mdi-account-hard-hat'
                return (
                  <v-chip
                    size="small"
                    color={isAdminR ? 'primary' : isManagerR ? 'deep-purple' : isUserR ? 'teal' : 'secondary'}
                    variant="tonal"
                    prepend-icon={icon}
                  >
                    {label}
                  </v-chip>
                )
              },
              'item.isActive': ({ item }: any) => (
                <v-chip size="small" color={item.isActive ? 'success' : 'error'} variant="tonal">
                  {item.isActive ? 'Активний' : 'Деактивований'}
                </v-chip>
              ),
              'item.createdAt': ({ item }: any) => (
                <span>{new Date(item.createdAt).toLocaleDateString('uk-UA')}</span>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end">
                  <v-btn
                    icon="mdi-pencil"
                    variant="text"
                    size="small"
                    color="primary"
                    onClick={() => {
                      refreshJobTitles()
                      openEdit(item)
                    }}
                  />
                  {item.id !== currentUser.value?.id && (
                    <v-btn
                      icon={item.isActive ? 'mdi-account-off' : 'mdi-account-check'}
                      variant="text"
                      size="small"
                      color={item.isActive ? 'error' : 'success'}
                      onClick={() => toggleActive(item)}
                    />
                  )}
                </div>
              ),
            }}
          </v-data-table>
        </v-card>

        {/* Create dialog */}
        <v-dialog v-model={createDialog.value} max-width={520}>
          <v-card>
            <v-card-title class="pa-4">Новий користувач</v-card-title>
            <v-card-text class="pa-4 pt-0">
              {error.value && <v-alert type="error" variant="tonal" class="mb-4">{error.value}</v-alert>}
              <v-text-field v-model={createForm.name} label="Імʼя *" class="mb-4" />
              <v-text-field v-model={createForm.email} label="Email *" type="email" class="mb-4" />
              <v-text-field v-model={createForm.password} label="Пароль *" type="password" class="mb-4" />
              <div class="d-flex mb-4" style="gap:16px">
                <v-select
                  v-model={createForm.role}
                  label="Роль"
                  items={roleOptions}
                  item-title="title"
                  item-value="value"
                  style="flex:1"
                />
                <v-text-field
                  v-model={createForm.phone}
                  label="Телефон"
                  placeholder="+380..."
                  prepend-inner-icon="mdi-phone"
                  style="flex:1"
                />
              </div>
              <v-autocomplete
                v-model={createForm.jobTitleId}
                label="Посада"
                items={jobTitleItems.value}
                item-title="name"
                item-value="id"
                clearable
                variant="outlined"
                density="compact"
                class="mb-2"
                hide-details="auto"
                no-data-text="Немає посад — створіть у розділі «Посади»"
              />
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (createDialog.value = false)}>Скасувати</v-btn>
              <v-btn
                color="primary"
                variant="elevated"
                loading={saving.value}
                disabled={!createForm.name || !createForm.email || !createForm.password}
                onClick={createUser}
              >
                Створити
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        {/* Edit dialog */}
        <v-dialog v-model={editDialog.value} max-width={520}>
          <v-card>
            <v-card-title class="pa-4">Редагувати користувача</v-card-title>
            <v-card-text class="pa-4 pt-0">
              {error.value && <v-alert type="error" variant="tonal" class="mb-4">{error.value}</v-alert>}
              <v-text-field v-model={editForm.name} label="Імʼя *" class="mb-4" />
              <div class="d-flex mb-4" style="gap:16px">
                <v-select
                  v-model={editForm.role}
                  label="Роль"
                  items={roleOptions}
                  item-title="title"
                  item-value="value"
                  style="flex:1"
                />
                <v-text-field
                  v-model={editForm.phone}
                  label="Телефон"
                  placeholder="+380..."
                  prepend-inner-icon="mdi-phone"
                  style="flex:1"
                />
              </div>
              <v-autocomplete
                v-model={editForm.jobTitleId}
                label="Посада"
                items={jobTitleItems.value}
                item-title="name"
                item-value="id"
                clearable
                variant="outlined"
                density="compact"
                class="mb-4"
                hide-details="auto"
                no-data-text="Немає посад — створіть у розділі «Посади»"
              />
              {editItem.value?.telegramChatId && (
                <v-chip color="success" variant="tonal" prepend-icon="mdi-send-check" class="mb-4">
                  Telegram підключено
                </v-chip>
              )}
              <v-switch
                v-model={editForm.isActive}
                label={editForm.isActive ? 'Активний' : 'Деактивований'}
                color="success"
                hide-details
              />
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (editDialog.value = false)}>Скасувати</v-btn>
              <v-btn color="primary" variant="elevated" loading={saving.value} disabled={!editForm.name} onClick={saveEdit}>
                Зберегти
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
