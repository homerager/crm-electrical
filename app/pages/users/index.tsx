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

    const createDialog = ref(false)
    const editDialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const editItem = ref<any>(null)

    const createForm = reactive({ name: '', email: '', password: '', role: 'STOREKEEPER', phone: '' })
    const editForm = reactive({ name: '', role: 'STOREKEEPER', isActive: true, phone: '' })


    const roleOptions = [
      { title: 'Адміністратор', value: 'ADMIN' },
      { title: 'Комірник', value: 'STOREKEEPER' },
    ]

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(editForm, {
        name: item.name,
        role: item.role,
        isActive: item.isActive,
        phone: item.phone ?? '',
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
          body: createForm,
        })
        // Save phone separately if provided
        if (createForm.phone) {
          const created = await $fetch<any>('/api/users').then((r: any) =>
            r.users.find((u: any) => u.email === createForm.email)
          )
          if (created) {
            await $fetch(`/api/users/${created.id}`, { method: 'PUT', body: { phone: createForm.phone } })
          }
        }
        createDialog.value = false
        Object.assign(createForm, { name: '', email: '', password: '', role: 'STOREKEEPER', phone: '' })
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
          body: editForm,
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
      { title: 'Статус', key: 'isActive', width: 120 },
      { title: 'Реєстрація', key: 'createdAt', width: 140 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 100 },
    ]

    return () => (
      <div>
        <div class="d-flex align-center mb-4">
          <div class="text-h5 font-weight-bold">Користувачі</div>
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-account-plus" onClick={() => { error.value = ''; createDialog.value = true }}>
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
                <v-btn
                  href="https://t.me/proelectric_crm_bot"
                  target="_blank"
                  color="primary"
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-send"
                  class="mr-2"
                >
                  Відкрити бота
                </v-btn>
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
              'item.role': ({ item }: any) => (
                <v-chip
                  size="small"
                  color={item.role === 'ADMIN' ? 'primary' : 'secondary'}
                  variant="tonal"
                  prepend-icon={item.role === 'ADMIN' ? 'mdi-shield-account' : 'mdi-account-hard-hat'}
                >
                  {item.role === 'ADMIN' ? 'Адміністратор' : 'Комірник'}
                </v-chip>
              ),
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
                  <v-btn icon="mdi-pencil" variant="text" size="small" color="primary" onClick={() => openEdit(item)} />
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
