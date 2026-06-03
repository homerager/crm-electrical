import {
  PERMISSION_MODULES,
  ACTION_LABELS,
  defaultPermissionsForRole,
  effectivePermissions,
  type Role,
} from '~~/shared/permissions'
import TableExportBtn from '~/components/TableExportBtn'

export default defineComponent({
  name: 'UsersPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Користувачі' })

    const { can, user: currentUser } = useAuth()
    const toast = useToast()
    const router = useRouter()

    /** Доступ до сторінки. Керування (створення/редагування) — окремий дозвіл. */
    const canManage = computed(() => can('users.manage'))

    const { data, refresh, pending } = useFetch('/api/users')
    const users = computed(() => (data.value as any)?.users ?? [])

    const { data: jobTitlesData, refresh: refreshJobTitles } = useFetch('/api/job-titles')
    const jobTitleItems = computed(() => (jobTitlesData.value as any)?.jobTitles ?? [])

    const createDialog = ref(false)
    const editDialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const editItem = ref<any>(null)

    const createPwdShow = ref(false)
    function generateCreatePassword() {
      createForm.password = randomPassword()
      createPwdShow.value = true
    }

    // ── Скидання паролю адміністратором ──────────────────────
    const resetPwdDialog = ref(false)
    const resetPwdTarget = ref<any>(null)
    const resetPwdValue = ref('')
    const resetPwdShow = ref(false)
    const resetPwdSaving = ref(false)
    const resetPwdError = ref('')
    const resetPwdDone = ref(false)
    const resetPwdCopied = ref(false)

    function openResetPassword(item: any) {
      resetPwdTarget.value = item
      resetPwdValue.value = ''
      resetPwdShow.value = false
      resetPwdError.value = ''
      resetPwdDone.value = false
      resetPwdCopied.value = false
      resetPwdDialog.value = true
    }

    function randomPassword() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
      const arr = new Uint32Array(14)
      crypto.getRandomValues(arr)
      return Array.from(arr, (n) => chars[n % chars.length]).join('')
    }

    function generateResetPassword() {
      resetPwdValue.value = randomPassword()
      resetPwdShow.value = true
      resetPwdCopied.value = false
    }

    async function copyPassword() {
      try {
        await navigator.clipboard.writeText(resetPwdValue.value)
        resetPwdCopied.value = true
      } catch {
        resetPwdCopied.value = false
      }
    }

    async function submitResetPassword() {
      if (!resetPwdTarget.value || resetPwdValue.value.length < 8) return
      resetPwdSaving.value = true
      resetPwdError.value = ''
      try {
        await $fetch(`/api/users/${resetPwdTarget.value.id}/reset-password`, {
          method: 'POST',
          body: { password: resetPwdValue.value },
        })
        resetPwdDone.value = true
        toast.success('Пароль скинуто')
      } catch (e: any) {
        resetPwdError.value = e?.data?.statusMessage || 'Помилка скидання паролю'
        toast.error(resetPwdError.value)
      } finally {
        resetPwdSaving.value = false
      }
    }

    const createForm = reactive({
      name: '',
      email: '',
      password: '',
      role: 'STOREKEEPER',
      phone: '',
      jobTitleId: null as string | null,
      hourlyRate: '',
    })
    const editForm = reactive({
      name: '',
      role: 'STOREKEEPER',
      isActive: true,
      emailNotifications: true,
      lowStockNotifications: false,
      phone: '',
      jobTitleId: null as string | null,
      hourlyRate: '',
    })

    // ── Матриця дозволів (індивідуальні overrides поверх дефолтів ролі) ──
    const editOverrides = reactive<Record<string, boolean>>({})
    const roleDefaultSet = computed(() => new Set(defaultPermissionsForRole(editForm.role as Role)))
    const effectiveSet = computed(() => effectivePermissions(editForm.role as Role, editOverrides))
    const isAdminRole = computed(() => editForm.role === 'ADMIN')
    const overrideCount = computed(() => Object.keys(editOverrides).length)

    function isGranted(perm: string) {
      return isAdminRole.value || effectiveSet.value.has(perm)
    }
    function isOverridden(perm: string) {
      return perm in editOverrides
    }
    function togglePerm(perm: string, value: boolean) {
      const isDefault = roleDefaultSet.value.has(perm)
      if (value === isDefault) delete editOverrides[perm]
      else editOverrides[perm] = value
    }
    function resetPermsToRole() {
      for (const k of Object.keys(editOverrides)) delete editOverrides[k]
    }
    function grantedInModule(moduleKey: string, actions: string[]) {
      return actions.filter((a) => isGranted(`${moduleKey}.${a}`)).length
    }

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
      { title: 'Працівник', value: 'EMPLOYEE' },
    ]

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(editForm, {
        name: item.name,
        role: item.role,
        isActive: item.isActive,
        emailNotifications: item.emailNotifications ?? true,
        lowStockNotifications: item.lowStockNotifications ?? false,
        phone: item.phone ?? '',
        jobTitleId: item.jobTitleId ?? null,
        hourlyRate: item.hourlyRate != null && item.hourlyRate !== '' ? String(item.hourlyRate) : '',
      })
      resetPermsToRole()
      Object.assign(editOverrides, (item.permissionOverrides ?? {}) as Record<string, boolean>)
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
            ...(createForm.hourlyRate.trim() !== '' && { hourlyRate: createForm.hourlyRate.trim() }),
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
          hourlyRate: '',
        })
        await refresh()
        toast.success('Користувача створено')
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка створення'
        toast.error(error.value)
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
            emailNotifications: editForm.emailNotifications,
            lowStockNotifications: editForm.lowStockNotifications,
            phone: editForm.phone,
            jobTitleId: editForm.jobTitleId || null,
            hourlyRate: editForm.hourlyRate.trim() === '' ? null : editForm.hourlyRate.trim(),
            permissionOverrides: { ...editOverrides },
          },
        })
        editDialog.value = false
        await refresh()
        toast.success('Користувача оновлено')
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
        toast.error(error.value)
      } finally {
        saving.value = false
      }
    }

    async function toggleActive(item: any) {
      try {
        await $fetch(`/api/users/${item.id}`, {
          method: 'PUT',
          body: { isActive: !item.isActive },
        })
        await refresh()
        toast.success(item.isActive ? 'Користувача деактивовано' : 'Користувача активовано')
      } catch (e: any) {
        toast.error(e?.data?.statusMessage || 'Помилка збереження')
      }
    }

    const headers = [
      { title: 'Імʼя', key: 'name' },
      { title: 'Email', key: 'email' },
      { title: 'Телефон', key: 'phone', width: 160 },
      { title: 'Telegram', key: 'telegram', width: 130 },
      { title: 'Роль', key: 'role', width: 160 },
      { title: 'Посада', key: 'jobTitle', width: 180 },
      { title: 'Ставка', key: 'hourlyRate', width: 110 },
      { title: 'Статус', key: 'isActive', width: 120 },
      { title: 'Реєстрація', key: 'createdAt', width: 140 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 100 },
    ]

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Користувачі</div>
          <v-spacer />
          <TableExportBtn
            class="mr-2"
            filename="Користувачі"
            rows={users.value}
            columns={[
              { title: "Ім'я", key: 'name' },
              { title: 'Email', key: 'email' },
              { title: 'Телефон', key: 'phone' },
              { title: 'Роль', key: 'role' },
              { title: 'Посада', key: 'jobTitle.name' },
              { title: 'Ставка/год', key: 'hourlyRate', format: (v) => (v == null ? '' : Number(v)) },
              { title: 'Статус', key: 'isActive', format: (v) => (v ? 'Активний' : 'Неактивний') },
              { title: 'Реєстрація', key: 'createdAt', format: (v) => (v ? new Date(v).toLocaleDateString('uk-UA') : '') },
            ]}
          />
          {canManage.value && (
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
          )}
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
              'item.hourlyRate': ({ item }: any) => (
                <span class={item.hourlyRate != null && item.hourlyRate !== '' ? '' : 'text-disabled'}>
                  {item.hourlyRate != null && item.hourlyRate !== ''
                    ? `${Number(item.hourlyRate).toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₴/год`
                    : '—'}
                </span>
              ),
              'item.role': ({ item }: any) => {
                const r = item.role as string
                const isAdminR = r === 'ADMIN'
                const isManagerR = r === 'MANAGER'
                const isUserR = r === 'USER'
                const isEmployeeR = r === 'EMPLOYEE'
                const label = isAdminR
                  ? 'Адміністратор'
                  : isManagerR
                    ? 'Менеджер'
                    : isUserR
                      ? 'Користувач'
                      : isEmployeeR
                        ? 'Працівник'
                        : 'Комірник'
                const icon = isAdminR
                  ? 'mdi-shield-account'
                  : isManagerR
                    ? 'mdi-account-tie'
                    : isUserR
                      ? 'mdi-account'
                      : isEmployeeR
                        ? 'mdi-badge-account-horizontal-outline'
                        : 'mdi-account-hard-hat'
                return (
                  <v-chip
                    size="small"
                    color={
                      isAdminR ? 'primary'
                        : isManagerR ? 'deep-purple'
                          : isUserR ? 'teal'
                            : isEmployeeR ? 'blue-grey'
                              : 'secondary'
                    }
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
                  {canManage.value
                    ? (
                      <>
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
                      </>
                    )
                    : <span class="text-disabled">—</span>}
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
              <v-text-field
                v-model={createForm.password}
                label="Пароль *"
                type={createPwdShow.value ? 'text' : 'password'}
                class="mb-1"
              >
                {{
                  'append-inner': () => (
                    <v-btn
                      type="button"
                      icon={createPwdShow.value ? 'mdi-eye-off' : 'mdi-eye'}
                      variant="text"
                      size="small"
                      tabindex={-1}
                      onMousedown={(e: MouseEvent) => e.preventDefault()}
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation()
                        createPwdShow.value = !createPwdShow.value
                      }}
                    />
                  ),
                }}
              </v-text-field>
              <v-btn
                variant="text"
                color="primary"
                size="small"
                prepend-icon="mdi-dice-multiple-outline"
                class="mb-4"
                onClick={generateCreatePassword}
              >
                Згенерувати пароль
              </v-btn>
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
                class="mb-4"
                hide-details="auto"
                no-data-text="Немає посад — створіть у розділі «Посади»"
              />
              <v-text-field
                v-model={createForm.hourlyRate}
                label="Ставка (грн/год)"
                type="text"
                inputmode="decimal"
                placeholder="напр. 350"
                prepend-inner-icon="mdi-currency-uah"
                hint="Для зарплатного звіту за годинами"
                persistent-hint
                class="mb-2"
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
        <v-dialog v-model={editDialog.value} max-width={720}>
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
              <v-text-field
                v-model={editForm.hourlyRate}
                label="Ставка (грн/год)"
                type="text"
                inputmode="decimal"
                placeholder="напр. 350"
                prepend-inner-icon="mdi-currency-uah"
                hint="Залиште порожнім, щоб скинути"
                persistent-hint
                class="mb-4"
              />
              {editItem.value?.telegramChatId && (
                <v-chip color="success" variant="tonal" prepend-icon="mdi-send-check" class="mb-4">
                  Telegram підключено
                </v-chip>
              )}
              <div class="d-flex flex-column gap-1 flex-wrap">
                <v-switch
                  v-model={editForm.isActive}
                  label={editForm.isActive ? 'Активний' : 'Деактивований'}
                  color="success"
                  hide-details
                />
                <v-switch
                  v-model={editForm.emailNotifications}
                  label="Email-сповіщення"
                  color="primary"
                  hide-details
                  prepend-icon={editForm.emailNotifications ? 'mdi-email-outline' : 'mdi-email-off-outline'}
                />
                <v-switch
                  v-model={editForm.lowStockNotifications}
                  label="Сповіщення про мін. залишки"
                  color="warning"
                  hide-details
                  prepend-icon={editForm.lowStockNotifications ? 'mdi-bell-alert-outline' : 'mdi-bell-off-outline'}
                />
              </div>

              <v-divider class="my-4" />

              {/* ── Права доступу ───────────────────────────────── */}
              <div class="d-flex align-center mb-2" style="gap:8px">
                <v-icon color="primary">mdi-shield-key-outline</v-icon>
                <span class="text-subtitle-2 font-weight-bold">Права доступу</span>
                {overrideCount.value > 0 && (
                  <v-chip size="x-small" color="warning" variant="tonal">
                    Індивідуальних: {overrideCount.value}
                  </v-chip>
                )}
                <v-spacer />
                <v-btn
                  variant="text"
                  size="small"
                  color="primary"
                  prepend-icon="mdi-restore"
                  disabled={isAdminRole.value || overrideCount.value === 0}
                  onClick={resetPermsToRole}
                >
                  За роллю
                </v-btn>
              </div>

              {isAdminRole.value
                ? (
                  <v-alert type="info" variant="tonal" density="compact" class="mb-2">
                    Адміністратор має повний доступ до всіх розділів. Права не налаштовуються.
                  </v-alert>
                )
                : (
                  <>
                    <div class="text-caption text-medium-emphasis mb-2">
                      Галочки за замовчуванням визначає роль. Зміна окремої галочки створює
                      <span class="text-warning font-weight-medium"> індивідуальне</span> право для цього користувача.
                    </div>
                    <v-expansion-panels variant="accordion" multiple class="mb-2">
                      {PERMISSION_MODULES.map((mod) => {
                        const granted = grantedInModule(mod.key, mod.actions)
                        return (
                          <v-expansion-panel key={mod.key}>
                            {{
                              title: () => (
                                <div class="d-flex align-center" style="gap:8px; width:100%">
                                  <span class="font-weight-medium">{mod.label}</span>
                                  <v-spacer />
                                  <v-chip
                                    size="x-small"
                                    variant="tonal"
                                    color={granted === 0 ? 'default' : granted === mod.actions.length ? 'success' : 'primary'}
                                  >
                                    {granted}/{mod.actions.length}
                                  </v-chip>
                                </div>
                              ),
                              text: () => (
                                <div class="d-flex flex-wrap" style="gap:4px 20px">
                                  {mod.actions.map((action) => {
                                    const perm = `${mod.key}.${action}`
                                    return (
                                      <v-checkbox
                                        key={perm}
                                        modelValue={isGranted(perm)}
                                        onUpdate:modelValue={(v: boolean | null) => togglePerm(perm, !!v)}
                                        density="compact"
                                        hide-details
                                        color="primary"
                                        class={isOverridden(perm) ? 'perm-override' : ''}
                                      >
                                        {{
                                          label: () => (
                                            <span class={isOverridden(perm) ? 'text-warning font-weight-medium' : ''}>
                                              {ACTION_LABELS[action] ?? action}
                                              {isOverridden(perm) && ' •'}
                                            </span>
                                          ),
                                        }}
                                      </v-checkbox>
                                    )
                                  })}
                                </div>
                              ),
                            }}
                          </v-expansion-panel>
                        )
                      })}
                    </v-expansion-panels>
                  </>
                )}

              <v-divider class="my-4" />
              <v-btn
                variant="tonal"
                color="warning"
                prepend-icon="mdi-lock-reset"
                onClick={() => {
                  const target = editItem.value
                  editDialog.value = false
                  openResetPassword(target)
                }}
              >
                Скинути пароль
              </v-btn>
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

        {/* Reset password dialog */}
        <v-dialog v-model={resetPwdDialog.value} max-width={460} persistent={resetPwdSaving.value}>
          <v-card>
            <v-card-title class="pa-4 d-flex align-center" style="gap:8px">
              <v-icon color="warning">mdi-lock-reset</v-icon>
              Скидання паролю
            </v-card-title>
            <v-card-text class="pa-4 pt-0">
              <div class="text-body-2 text-medium-emphasis mb-4">
                Користувач: <span class="font-weight-medium">{resetPwdTarget.value?.name}</span>
                {' '}({resetPwdTarget.value?.email})
              </div>

              {resetPwdDone.value
                ? (
                  <>
                    <v-alert
                      type="success"
                      variant="tonal"
                      density="comfortable"
                      icon="mdi-lock-check-outline"
                      class="mb-3"
                    >
                      Пароль скинуто. Передайте новий пароль користувачу.
                    </v-alert>
                    <v-text-field
                      modelValue={resetPwdValue.value}
                      label="Новий пароль"
                      readonly
                      variant="outlined"
                      density="compact"
                      hide-details
                      append-inner-icon={resetPwdCopied.value ? 'mdi-check' : 'mdi-content-copy'}
                      onClick:appendInner={copyPassword}
                    />
                  </>
                )
                : (
                  <>
                    {resetPwdError.value && (
                      <v-alert
                        type="error"
                        variant="tonal"
                        density="compact"
                        class="mb-4"
                        closable
                        onUpdate:modelValue={() => (resetPwdError.value = '')}
                      >
                        {resetPwdError.value}
                      </v-alert>
                    )}
                    <v-text-field
                      v-model={resetPwdValue.value}
                      label="Новий пароль *"
                      type={resetPwdShow.value ? 'text' : 'password'}
                      prepend-inner-icon="mdi-lock-outline"
                      autocomplete="new-password"
                      hint="Щонайменше 8 символів"
                      persistent-hint
                      onKeydown={(e: KeyboardEvent) => e.key === 'Enter' && submitResetPassword()}
                    >
                      {{
                        'append-inner': () => (
                          <v-btn
                            type="button"
                            icon={resetPwdShow.value ? 'mdi-eye-off' : 'mdi-eye'}
                            variant="text"
                            size="small"
                            tabindex={-1}
                            onMousedown={(e: MouseEvent) => e.preventDefault()}
                            onClick={(e: MouseEvent) => {
                              e.stopPropagation()
                              resetPwdShow.value = !resetPwdShow.value
                            }}
                          />
                        ),
                      }}
                    </v-text-field>
                    <v-btn
                      variant="text"
                      color="primary"
                      size="small"
                      prepend-icon="mdi-dice-multiple-outline"
                      class="mt-2"
                      onClick={generateResetPassword}
                    >
                      Згенерувати пароль
                    </v-btn>
                  </>
                )}
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              {resetPwdDone.value
                ? (
                  <v-btn color="primary" variant="elevated" onClick={() => (resetPwdDialog.value = false)}>
                    Закрити
                  </v-btn>
                )
                : (
                  <>
                    <v-btn
                      variant="outlined"
                      disabled={resetPwdSaving.value}
                      onClick={() => (resetPwdDialog.value = false)}
                    >
                      Скасувати
                    </v-btn>
                    <v-btn
                      color="warning"
                      variant="elevated"
                      loading={resetPwdSaving.value}
                      disabled={resetPwdValue.value.length < 8}
                      onClick={submitResetPassword}
                    >
                      Скинути пароль
                    </v-btn>
                  </>
                )}
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
