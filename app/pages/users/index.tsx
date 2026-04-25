export default defineComponent({
  name: 'UsersPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({
      title: 'Користувачі'
    })

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

    const createForm = reactive({ name: '', email: '', password: '', role: 'STOREKEEPER' })
    const editForm = reactive({ name: '', role: 'STOREKEEPER', isActive: true })

    const roleOptions = [
      { title: 'Адміністратор', value: 'ADMIN' },
      { title: 'Комірник', value: 'STOREKEEPER' },
    ]

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(editForm, { name: item.name, role: item.role, isActive: item.isActive })
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
        createDialog.value = false
        Object.assign(createForm, { name: '', email: '', password: '', role: 'STOREKEEPER' })
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
      { title: 'Роль', key: 'role', width: 160 },
      { title: 'Статус', key: 'isActive', width: 120 },
      { title: 'Дата реєстрації', key: 'createdAt', width: 160 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 120 },
    ]

    return () => (
      <div>
        <div class="d-flex align-center mb-4">
          <div class="text-h5 font-weight-bold">Користувачі</div>
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-account-plus" onClick={() => (createDialog.value = true)}>
            Додати користувача
          </v-btn>
        </div>

        <v-card>
          <v-data-table headers={headers} items={users.value} loading={pending.value} hover>
            {{
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
                      title={item.isActive ? 'Деактивувати' : 'Активувати'}
                    />
                  )}
                </div>
              ),
            }}
          </v-data-table>
        </v-card>

        <v-dialog v-model={createDialog.value} max-width={500}>
          <v-card>
            <v-card-title>Новий користувач</v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-text-field v-model={createForm.name} label="Імʼя *" class="mb-3" />
              <v-text-field v-model={createForm.email} label="Email *" type="email" class="mb-3" />
              <v-text-field v-model={createForm.password} label="Пароль *" type="password" class="mb-3" />
              <v-select
                v-model={createForm.role}
                label="Роль"
                items={roleOptions}
                item-title="title"
                item-value="value"
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

        <v-dialog v-model={editDialog.value} max-width={500}>
          <v-card>
            <v-card-title>Редагувати користувача</v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-text-field v-model={editForm.name} label="Імʼя *" class="mb-3" />
              <v-select
                v-model={editForm.role}
                label="Роль"
                items={roleOptions}
                item-title="title"
                item-value="value"
                class="mb-3"
              />
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
