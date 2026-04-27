const PROJECT_COLORS = [
  '#1976D2', '#388E3C', '#F57C00', '#7B1FA2',
  '#C62828', '#00838F', '#4527A0', '#2E7D32',
  '#E64A19', '#1565C0',
]

export default defineComponent({
  name: 'ProjectsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Проєкти' })

    const { isAdmin } = useAuth()
    const dialog = ref(false)
    const editDialog = ref(false)
    const deleteDialog = ref(false)
    const saving = ref(false)
    const deleting = ref(false)
    const error = ref('')
    const editTarget = ref<any>(null)
    const deleteTarget = ref<any>(null)

    const form = reactive({
      name: '',
      description: '',
      color: '#1976D2',
      memberIds: [] as string[],
    })

    const { data: projectsData, refresh } = useFetch('/api/projects')
    const projects = computed(() => (projectsData.value as any[]) ?? [])

    const { data: usersData } = useFetch('/api/users/list')
    const users = computed(() => (usersData.value as any[]) ?? [])

    function openCreate() {
      form.name = ''
      form.description = ''
      form.color = '#1976D2'
      form.memberIds = []
      error.value = ''
      dialog.value = true
    }

    function openEdit(project: any) {
      editTarget.value = project
      form.name = project.name
      form.description = project.description ?? ''
      form.color = project.color ?? '#1976D2'
      form.memberIds = project.members.map((m: any) => m.user.id)
      error.value = ''
      editDialog.value = true
    }

    function openDelete(project: any) {
      deleteTarget.value = project
      deleteDialog.value = true
    }

    async function saveCreate() {
      if (!form.name.trim()) { error.value = 'Назва обовʼязкова'; return }
      saving.value = true
      error.value = ''
      try {
        await $fetch('/api/projects', {
          method: 'POST',
          body: { name: form.name, description: form.description, color: form.color, memberIds: form.memberIds },
        })
        dialog.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.message || 'Помилка'
      } finally {
        saving.value = false
      }
    }

    async function saveEdit() {
      if (!form.name.trim()) { error.value = 'Назва обовʼязкова'; return }
      saving.value = true
      error.value = ''
      const id = editTarget.value.id
      try {
        await $fetch(`/api/projects/${id}`, {
          method: 'PUT',
          body: { name: form.name, description: form.description, color: form.color },
        })

        // Sync members: add new, remove removed
        const currentMemberIds: string[] = editTarget.value.members.map((m: any) => m.user.id)
        const toAdd = form.memberIds.filter((uid: string) => !currentMemberIds.includes(uid))
        const toRemove = currentMemberIds.filter((uid: string) => !form.memberIds.includes(uid))

        for (const uid of toAdd) {
          await $fetch(`/api/projects/${id}/members`, { method: 'POST', body: { userId: uid } })
        }
        for (const uid of toRemove) {
          await $fetch(`/api/projects/${id}/members/${uid}`, { method: 'DELETE' }).catch(() => {})
        }

        editDialog.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.message || 'Помилка'
      } finally {
        saving.value = false
      }
    }

    async function confirmDelete() {
      if (!deleteTarget.value) return
      deleting.value = true
      try {
        await $fetch(`/api/projects/${deleteTarget.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
      } finally {
        deleting.value = false
      }
    }

    const router = useRouter()

    function renderForm(isEdit: boolean) {
      return (
        <v-card-text>
          {error.value && <v-alert type="error" class="mb-4">{error.value}</v-alert>}
          <v-text-field
            v-model={form.name}
            label="Назва проєкту *"
            variant="outlined"
            density="compact"
            class="mb-4"
          />
          <v-textarea
            v-model={form.description}
            label="Опис"
            variant="outlined"
            density="compact"
            rows={3}
            class="mb-4"
          />
          <div class="mb-4">
            <div class="text-caption mb-2">Колір</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              {PROJECT_COLORS.map((c) => (
                <div
                  key={c}
                  onClick={() => { form.color = c }}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: c, cursor: 'pointer',
                    border: form.color === c ? '3px solid white' : '3px solid transparent',
                    outline: form.color === c ? `2px solid ${c}` : 'none',
                  }}
                />
              ))}
            </div>
          </div>
          <v-autocomplete
            v-model={form.memberIds}
            label="Учасники"
            items={users.value}
            itemTitle="name"
            itemValue="id"
            multiple
            chips
            closableChips
            variant="outlined"
            density="compact"
          />
        </v-card-text>
      )
    }

    return () => (
      <v-container fluid>
        <div class="d-flex align-center mb-6" style="gap:16px">
          <div class="title-container">
            <h1 class="text-h5 font-weight-bold">Проєкти</h1>
            <div class="text-caption text-medium-emphasis">Управління проєктами та доступом</div>
          </div>
          <v-spacer />
          {isAdmin.value && (
            <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
              Новий проєкт
            </v-btn>
          )}
        </div>

        {projects.value.length === 0 && (
          <v-card class="text-center pa-12" variant="outlined">
            <v-icon size="64" color="medium-emphasis" class="mb-4">mdi-folder-off-outline</v-icon>
            <div class="text-h6 text-medium-emphasis">Немає проєктів</div>
            <div class="text-body-2 text-medium-emphasis mt-2">Створіть перший проєкт для організації завдань</div>
            {isAdmin.value && (
              <v-btn color="primary" class="mt-4" prepend-icon="mdi-plus" onClick={openCreate}>
                Створити проєкт
              </v-btn>
            )}
          </v-card>
        )}

        <v-row>
          {projects.value.map((project: any) => (
            <v-col key={project.id} cols={12} sm={6} md={4} lg={3}>
              <v-card
                class="h-100"
                style="cursor:pointer"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <div style={{ height: '6px', background: project.color, borderRadius: '4px 4px 0 0' }} />
                <v-card-title class="pt-4 pb-1">{project.name}</v-card-title>
                {project.description && (
                  <v-card-subtitle>{project.description}</v-card-subtitle>
                )}
                <v-card-text>
                  <div class="d-flex align-center mb-3" style="gap:8px">
                    <v-icon size="16" color="medium-emphasis">mdi-checkbox-marked-circle-outline</v-icon>
                    <span class="text-body-2">{project._count?.tasks ?? 0} завдань</span>
                  </div>
                  <div class="d-flex" style="gap:-8px">
                    {project.members.slice(0, 5).map((m: any) => (
                      <v-avatar
                        key={m.user.id}
                        size="28"
                        color={project.color}
                        style="border: 2px solid rgba(0,0,0,0.2); margin-left: -4px"
                        title={m.user.name}
                      >
                        <span class="text-caption" style="color:white;font-weight:700">
                          {m.user.name?.charAt(0)?.toUpperCase()}
                        </span>
                      </v-avatar>
                    ))}
                    {project.members.length > 5 && (
                      <v-avatar size="28" color="grey" style="border: 2px solid rgba(0,0,0,0.2); margin-left: -4px">
                        <span class="text-caption" style="color:white">+{project.members.length - 5}</span>
                      </v-avatar>
                    )}
                  </div>
                </v-card-text>
                <v-card-actions onClick={(e: MouseEvent) => e.stopPropagation()}>
                  <v-spacer />
                  <v-btn
                    size="small"
                    variant="text"
                    icon="mdi-pencil"
                    onClick={() => openEdit(project)}
                  />
                  {isAdmin.value && (
                    <v-btn
                      size="small"
                      variant="text"
                      color="error"
                      icon="mdi-delete"
                      onClick={() => openDelete(project)}
                    />
                  )}
                </v-card-actions>
              </v-card>
            </v-col>
          ))}
        </v-row>

        {/* Create dialog */}
        <v-dialog v-model={dialog.value} max-width={560} persistent>
          <v-card>
            <v-card-title class="pa-4">Новий проєкт</v-card-title>
            <v-divider />
            {renderForm(false)}
            <v-divider />
            <v-card-actions class="pa-4">
              <v-spacer />
              <v-btn variant="text" onClick={() => { dialog.value = false }}>Скасувати</v-btn>
              <v-btn color="primary" loading={saving.value} onClick={saveCreate}>Створити</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        {/* Edit dialog */}
        <v-dialog v-model={editDialog.value} max-width={560} persistent>
          <v-card>
            <v-card-title class="pa-4">Редагувати проєкт</v-card-title>
            <v-divider />
            {renderForm(true)}
            <v-divider />
            <v-card-actions class="pa-4">
              <v-spacer />
              <v-btn variant="text" onClick={() => { editDialog.value = false }}>Скасувати</v-btn>
              <v-btn color="primary" loading={saving.value} onClick={saveEdit}>Зберегти</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        {/* Delete dialog */}
        <v-dialog v-model={deleteDialog.value} max-width={400}>
          <v-card>
            <v-card-title class="pa-4">Видалити проєкт?</v-card-title>
            <v-card-text>
              Проєкт "<strong>{deleteTarget.value?.name}</strong>" буде видалено. Завдання залишаться, але будуть відʼєднані від проєкту.
            </v-card-text>
            <v-card-actions class="pa-4">
              <v-spacer />
              <v-btn variant="text" onClick={() => { deleteDialog.value = false }}>Скасувати</v-btn>
              <v-btn color="error" loading={deleting.value} onClick={confirmDelete}>Видалити</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-container>
    )
  },
})
