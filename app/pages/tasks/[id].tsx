import TaskCommentContent from '../../components/TaskCommentContent'
import TaskCommentEditor from '../../components/TaskCommentEditor'

const STATUSES = [
  { value: 'TODO', label: 'До виконання', color: 'blue-grey', icon: 'mdi-circle-outline' },
  { value: 'IN_PROGRESS', label: 'В роботі', color: 'blue', icon: 'mdi-progress-clock' },
  { value: 'REVIEW', label: 'На перевірці', color: 'orange', icon: 'mdi-eye-check-outline' },
  { value: 'DONE', label: 'Виконано', color: 'success', icon: 'mdi-check-circle-outline' },
  { value: 'CANCELLED', label: 'Скасовано', color: 'error', icon: 'mdi-close-circle-outline' },
]

const PRIORITIES = [
  { value: 'LOW', label: 'Низький', color: 'success', icon: 'mdi-arrow-down' },
  { value: 'MEDIUM', label: 'Середній', color: 'warning', icon: 'mdi-minus' },
  { value: 'HIGH', label: 'Високий', color: 'orange', icon: 'mdi-arrow-up' },
  { value: 'URGENT', label: 'Терміново', color: 'error', icon: 'mdi-alert' },
]

function statusMeta(val: string) {
  return STATUSES.find((s) => s.value === val) ?? STATUSES[0]
}
function priorityMeta(val: string) {
  return PRIORITIES.find((p) => p.value === val) ?? PRIORITIES[1]
}

export default defineComponent({
  name: 'TaskDetailPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const { user } = useAuth()
    const id = computed(() => route.params.id as string)

    const { data, refresh, pending } = useFetch(() => `/api/tasks/${id.value}`)
    const task = computed(() => data.value as any)

    useHead(computed(() => ({ title: task.value?.title ?? 'Завдання' })))

    const { data: usersData } = useFetch('/api/users')
    const { data: objectsData } = useFetch('/api/objects')
    const users = computed(() => (usersData.value as any)?.users ?? [])
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])

    // Edit task
    const editDialog = ref(false)
    const editForm = reactive({
      title: '',
      description: '',
      status: '',
      priority: '',
      assignedToId: '',
      objectId: '',
      dueDate: '',
      estimatedHours: '',
    })
    const editSaving = ref(false)
    const editError = ref('')

    function openEdit() {
      const t = task.value
      if (!t) return
      Object.assign(editForm, {
        title: t.title,
        description: t.description ?? '',
        status: t.status,
        priority: t.priority,
        assignedToId: t.assignedToId ?? '',
        objectId: t.objectId ?? '',
        dueDate: t.dueDate ? t.dueDate.substring(0, 10) : '',
        estimatedHours: t.estimatedHours != null ? String(t.estimatedHours) : '',
      })
      editError.value = ''
      editDialog.value = true
    }

    async function saveEdit() {
      editSaving.value = true
      editError.value = ''
      try {
        await $fetch(`/api/tasks/${id.value}`, {
          method: 'PUT',
          body: {
            ...editForm,
            assignedToId: editForm.assignedToId || null,
            objectId: editForm.objectId || null,
            dueDate: editForm.dueDate || null,
            estimatedHours: editForm.estimatedHours !== '' ? Number(editForm.estimatedHours) : null,
          },
        })
        editDialog.value = false
        await refresh()
      } catch (e: any) {
        editError.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        editSaving.value = false
      }
    }

    async function quickStatus(newStatus: string) {
      try {
        await $fetch(`/api/tasks/${id.value}`, { method: 'PUT', body: { status: newStatus } })
        await refresh()
      } catch {}
    }

    // Time logs
    const timeLogDialog = ref(false)
    const timeLogForm = reactive({ hours: '', description: '', date: '' })
    const timeLogSaving = ref(false)
    const timeLogError = ref('')

    function openTimeLog() {
      Object.assign(timeLogForm, {
        hours: '',
        description: '',
        date: new Date().toISOString().substring(0, 10),
      })
      timeLogError.value = ''
      timeLogDialog.value = true
    }

    async function saveTimeLog() {
      timeLogSaving.value = true
      timeLogError.value = ''
      try {
        await $fetch(`/api/tasks/${id.value}/time-logs`, {
          method: 'POST',
          body: {
            hours: Number(timeLogForm.hours),
            description: timeLogForm.description || null,
            date: timeLogForm.date || null,
          },
        })
        timeLogDialog.value = false
        await refresh()
      } catch (e: any) {
        timeLogError.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        timeLogSaving.value = false
      }
    }

    async function deleteTimeLog(logId: string) {
      try {
        await $fetch(`/api/time-logs/${logId}`, { method: 'DELETE' })
        await refresh()
      } catch {}
    }

    // Attachments
    const uploadInput = ref<HTMLInputElement | null>(null)
    const uploading = ref(false)
    const uploadError = ref('')
    const imagePreview = ref<{ url: string; name: string } | null>(null)
    const showImagePreview = ref(false)

    function triggerUpload() {
      uploadInput.value?.click()
    }

    async function handleFileChange(e: Event) {
      const input = e.target as HTMLInputElement
      if (!input.files?.length) return
      uploading.value = true
      uploadError.value = ''
      try {
        const formData = new FormData()
        for (const file of Array.from(input.files)) {
          formData.append('files', file)
        }
        await $fetch(`/api/tasks/${id.value}/attachments`, {
          method: 'POST',
          body: formData,
        })
        await refresh()
      } catch (e: any) {
        uploadError.value = e?.data?.statusMessage || 'Помилка завантаження'
      } finally {
        uploading.value = false
        input.value = ''
      }
    }

    async function deleteAttachment(attId: string) {
      try {
        await $fetch(`/api/attachments/${attId}`, { method: 'DELETE' })
        await refresh()
      } catch {}
    }

    function isImage(mime: string) {
      return mime.startsWith('image/')
    }
    function isVideo(mime: string) {
      return mime.startsWith('video/')
    }
    function fileIcon(mime: string) {
      if (mime.startsWith('image/')) return 'mdi-file-image'
      if (mime.startsWith('video/')) return 'mdi-file-video'
      if (mime.includes('pdf')) return 'mdi-file-pdf-box'
      if (mime.includes('word') || mime.includes('document')) return 'mdi-file-word'
      if (mime.includes('excel') || mime.includes('sheet')) return 'mdi-file-excel'
      if (mime.includes('zip') || mime.includes('rar') || mime.includes('archive')) return 'mdi-zip-box'
      return 'mdi-file-outline'
    }
    function fileColor(mime: string) {
      if (mime.startsWith('image/')) return 'purple'
      if (mime.startsWith('video/')) return 'blue'
      if (mime.includes('pdf')) return 'error'
      if (mime.includes('word') || mime.includes('document')) return 'primary'
      if (mime.includes('excel') || mime.includes('sheet')) return 'success'
      return 'grey'
    }
    function formatSize(bytes: number) {
      if (bytes < 1024) return `${bytes} Б`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
      return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
    }

    /** Завантаження через API, щоб на production працювали файли (не тільки з .output/public). */
    function attachmentFileUrl(attachmentId: string) {
      return `/api/attachments/${attachmentId}`
    }

    const canDeleteAttachment = (att: any) =>
      att.userId === user.value?.id || user.value?.role === 'ADMIN'

    // Comments (HTML + reply / edit; файли в коменті — через pre-upload, потім лінк з POST/PUT)
    const commentClient = ref(false)
    onMounted(() => {
      commentClient.value = true
    })

    const commentHtml = ref('<p></p>')
    const commentTextEmpty = ref(true)
    const commentEditorKey = ref(0)
    const replyingTo = ref<{ id: string; name: string; at: string } | null>(null)
    const editingId = ref<string | null>(null)
    const pendingCommentFiles = ref<{ id: string; filename: string }[]>([])
    const commentFileInput = ref<HTMLInputElement | null>(null)
    const commentFileUploading = ref(false)
    const commentSaving = ref(false)
    const commentError = ref('')

    function clearCommentComposer() {
      replyingTo.value = null
      editingId.value = null
      commentHtml.value = '<p></p>'
      commentTextEmpty.value = true
      pendingCommentFiles.value = []
      commentEditorKey.value += 1
    }

    function isCommentEdited(c: { createdAt: string; updatedAt: string }) {
      return new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 1500
    }

    function startReplyTo(c: { id: string; user: { name: string }; createdAt: string }) {
      editingId.value = null
      replyingTo.value = { id: c.id, name: c.user.name, at: c.createdAt }
    }

    function startEditComment(c: { id: string; content: string }) {
      replyingTo.value = null
      editingId.value = c.id
      commentHtml.value = c.content && c.content.trim() ? c.content : '<p></p>'
      commentTextEmpty.value = false
      commentEditorKey.value += 1
      pendingCommentFiles.value = []
    }

    function triggerCommentFile() {
      commentFileInput.value?.click()
    }

    async function onCommentFileInput(e: Event) {
      const input = e.target as HTMLInputElement
      if (!input.files?.length) return
      commentFileUploading.value = true
      commentError.value = ''
      try {
        for (const file of Array.from(input.files)) {
          const formData = new FormData()
          formData.append('files', file)
          const r = (await $fetch<{ attachments: { id: string }[] }>(`/api/tasks/${id.value}/attachments`, {
            method: 'POST',
            body: formData,
          })) as { attachments: { id: string }[] }
          for (const a of r.attachments) {
            const at = a as { id: string; filename: string }
            pendingCommentFiles.value = [...pendingCommentFiles.value, { id: at.id, filename: at.filename }]
          }
        }
      } catch (e: any) {
        commentError.value = e?.data?.statusMessage || 'Помилка завантаження'
      } finally {
        commentFileUploading.value = false
        input.value = ''
      }
    }

    async function deletePendingByUnlink(attachmentId: string) {
      try {
        await $fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' })
        pendingCommentFiles.value = pendingCommentFiles.value.filter((p) => p.id !== attachmentId)
        await refresh()
      } catch {}
    }

    async function submitComment() {
      if (commentTextEmpty.value) return
      const html = commentHtml.value
      commentSaving.value = true
      commentError.value = ''
      try {
        if (editingId.value) {
          const pending = pendingCommentFiles.value.map((f) => f.id)
          await $fetch(`/api/tasks/${id.value}/comments/${editingId.value}`, {
            method: 'PUT',
            body: {
              content: html,
              attachmentIds: pending.length ? pending : undefined,
            },
          })
        } else {
          const ids = pendingCommentFiles.value.map((f) => f.id)
          await $fetch(`/api/tasks/${id.value}/comments`, {
            method: 'POST',
            body: {
              content: html,
              parentId: replyingTo.value?.id ?? null,
              attachmentIds: ids.length ? ids : undefined,
            },
          })
        }
        clearCommentComposer()
        await refresh()
      } catch (e: any) {
        commentError.value = e?.data?.statusMessage || 'Не вдалося зберегти'
      } finally {
        commentSaving.value = false
      }
    }

    async function deleteTaskComment(c: { id: string }) {
      if (!window.confirm('Видалити цей коментар?')) return
      try {
        if (editingId.value === c.id) clearCommentComposer()
        await $fetch(`/api/tasks/${id.value}/comments/${c.id}`, { method: 'DELETE' })
        await refresh()
      } catch (e: any) {
        commentError.value = e?.data?.statusMessage || 'Не вдалося видалити'
      }
    }

    const canMutateComment = (c: { userId: string }) =>
      c.userId === user.value?.id || user.value?.role === 'ADMIN'

    // Sub-tasks
    const subTaskDialog = ref(false)
    const subTaskForm = reactive({ title: '', priority: 'MEDIUM', assignedToId: '' })
    const subTaskSaving = ref(false)
    const subTaskError = ref('')

    function openSubTask() {
      Object.assign(subTaskForm, { title: '', priority: 'MEDIUM', assignedToId: '' })
      subTaskError.value = ''
      subTaskDialog.value = true
    }

    async function saveSubTask() {
      subTaskSaving.value = true
      subTaskError.value = ''
      try {
        await $fetch('/api/tasks', {
          method: 'POST',
          body: {
            title: subTaskForm.title,
            priority: subTaskForm.priority,
            assignedToId: subTaskForm.assignedToId || null,
            parentId: id.value,
          },
        })
        subTaskDialog.value = false
        await refresh()
      } catch (e: any) {
        subTaskError.value = e?.data?.statusMessage || 'Помилка створення'
      } finally {
        subTaskSaving.value = false
      }
    }

    async function changeSubTaskStatus(subTask: any, newStatus: string) {
      try {
        await $fetch(`/api/tasks/${subTask.id}`, { method: 'PUT', body: { status: newStatus } })
        await refresh()
      } catch {}
    }

    async function deleteSubTask(subTaskId: string) {
      try {
        await $fetch(`/api/tasks/${subTaskId}`, { method: 'DELETE' })
        await refresh()
      } catch {}
    }

    function formatDate(d: string | null) {
      if (!d) return '—'
      return new Date(d).toLocaleDateString('uk-UA')
    }

    function formatDateTime(d: string) {
      return new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    function isOverdue() {
      const t = task.value
      if (!t?.dueDate || t.status === 'DONE' || t.status === 'CANCELLED') return false
      return new Date(t.dueDate) < new Date()
    }

    const canEditTimeLog = (log: any) =>
      log.userId === user.value?.id || user.value?.role === 'ADMIN'

    return () => {
      if (pending.value && !task.value) {
        return (
          <div class="d-flex justify-center align-center" style="height:300px">
            <v-progress-circular indeterminate color="primary" />
          </div>
        )
      }

      if (!task.value) {
        return (
          <v-alert type="error">Завдання не знайдено</v-alert>
        )
      }

      const t = task.value
      const sm = statusMeta(t.status)
      const pm = priorityMeta(t.priority)

      return (
        <div>
          {/* Breadcrumb */}
          <v-breadcrumbs
            items={[
              { title: 'Завдання', href: '/tasks' },
              ...(t.parent ? [{ title: t.parent.title, href: `/tasks/${t.parent.id}` }] : []),
              { title: t.title, disabled: true },
            ]}
            class="px-0 pt-0 pb-4"
          />

          <div class="d-flex align-start" style="gap:16px">
            {/* Main content */}
            <div style="flex:1; min-width:0; overflow:hidden">

              {/* Title card */}
              <v-card class="mb-4">
                <v-card-text class="pa-4">
                  <div class="d-flex align-start gap-2 mb-3">
                    <div class="text-h6 font-weight-bold" style="flex:1">{t.title}</div>
                    <v-btn
                      prepend-icon="mdi-pencil"
                      variant="outlined"
                      size="small"
                      onClick={openEdit}
                    >
                      Редагувати
                    </v-btn>
                  </div>

                  <div class="d-flex gap-2 flex-wrap mb-3">
                    <v-chip color={sm.color} variant="tonal" prepend-icon={sm.icon} size="small">
                      {sm.label}
                    </v-chip>
                    <v-chip color={pm.color} variant="tonal" prepend-icon={pm.icon} size="small">
                      {pm.label}
                    </v-chip>
                    {t.dueDate && (
                      <v-chip
                        color={isOverdue() ? 'error' : 'default'}
                        variant="tonal"
                        prepend-icon="mdi-calendar"
                        size="small"
                      >
                        {formatDate(t.dueDate)}
                      </v-chip>
                    )}
                  </div>

                  {/* Quick status change */}
                  <div class="d-flex gap-2 flex-wrap">
                    {STATUSES.filter((s) => s.value !== t.status).map((s) => (
                      <v-btn
                        key={s.value}
                        size="x-small"
                        variant="tonal"
                        color={s.color}
                        prepend-icon={s.icon}
                        onClick={() => quickStatus(s.value)}
                      >
                        {s.label}
                      </v-btn>
                    ))}
                  </div>

                  {t.description && (
                    <div class="mt-4">
                      <div class="text-caption text-disabled mb-1">ОПИС</div>
                      <div class="text-body-2" style="white-space:pre-wrap">{t.description}</div>
                    </div>
                  )}
                </v-card-text>
              </v-card>

              {/* Sub-tasks */}
              {!t.parent && (
                <v-card class="mb-4">
                  <v-card-title class="pa-4 pb-0 d-flex align-center">
                    <v-icon class="mr-2" color="primary">mdi-file-tree</v-icon>
                    Підзавдання
                    <v-chip size="small" class="ml-2" variant="tonal">
                      {(t.subTasks ?? []).length}
                    </v-chip>
                    {(t.subTasks ?? []).length > 0 && (
                      <v-chip size="small" class="ml-1" color="success" variant="tonal">
                        {(t.subTasks ?? []).filter((s: any) => s.status === 'DONE').length} / {(t.subTasks ?? []).length}
                      </v-chip>
                    )}
                    <v-spacer />
                    <v-btn size="small" color="primary" prepend-icon="mdi-plus" onClick={openSubTask}>
                      Додати
                    </v-btn>
                  </v-card-title>

                  {(t.subTasks ?? []).length > 0 && (
                    <div class="px-4 pt-2">
                      <v-progress-linear
                        model-value={Math.round(
                          ((t.subTasks ?? []).filter((s: any) => s.status === 'DONE').length /
                            (t.subTasks ?? []).length) * 100
                        )}
                        color="success"
                        rounded
                        height={6}
                        bg-color="surface-variant"
                      />
                    </div>
                  )}

                  <v-list density="compact" class="pa-2">
                    {(t.subTasks ?? []).length === 0 && (
                      <v-list-item>
                        <v-list-item-title class="text-disabled text-caption">
                          Немає підзавдань
                        </v-list-item-title>
                      </v-list-item>
                    )}
                    {(t.subTasks ?? []).map((sub: any) => {
                      const ssm = statusMeta(sub.status)
                      const spm = priorityMeta(sub.priority)
                      return (
                        <v-list-item
                          key={sub.id}
                          rounded="lg"
                          class="mb-1"
                          style={{ opacity: sub.status === 'CANCELLED' ? 0.5 : 1 }}
                        >
                          {{
                            prepend: () => (
                              <v-menu>
                                {{
                                  activator: ({ props }: any) => (
                                    <v-icon
                                      {...props}
                                      color={ssm.color}
                                      size="20"
                                      style="cursor:pointer"
                                    >
                                      {ssm.icon}
                                    </v-icon>
                                  ),
                                  default: () => (
                                    <v-list density="compact">
                                      {STATUSES.filter((s) => s.value !== sub.status).map((s) => (
                                        <v-list-item
                                          key={s.value}
                                          prepend-icon={s.icon}
                                          title={s.label}
                                          onClick={() => changeSubTaskStatus(sub, s.value)}
                                        />
                                      ))}
                                    </v-list>
                                  ),
                                }}
                              </v-menu>
                            ),
                            default: () => (
                              <div class="d-flex align-center gap-2 flex-wrap">
                                <v-btn
                                  variant="text"
                                  class="text-none px-0 text-body-2"
                                  style={{ textDecoration: sub.status === 'DONE' ? 'line-through' : 'none', fontWeight: 500 }}
                                  to={`/tasks/${sub.id}`}
                                >
                                  {sub.title}
                                </v-btn>
                                <v-chip size="x-small" color={spm.color} variant="tonal" prepend-icon={spm.icon}>
                                  {spm.label}
                                </v-chip>
                                {sub.assignee && (
                                  <v-chip size="x-small" prepend-icon="mdi-account" variant="text">
                                    {sub.assignee.name}
                                  </v-chip>
                                )}
                              </div>
                            ),
                            append: () => (
                              <v-btn
                                icon="mdi-delete"
                                size="x-small"
                                variant="text"
                                color="error"
                                onClick={() => deleteSubTask(sub.id)}
                              />
                            ),
                          }}
                        </v-list-item>
                      )
                    })}
                  </v-list>
                </v-card>
              )}

              {/* Time logs */}
              <v-card class="mb-4">
                <v-card-title class="pa-4 pb-0 d-flex align-center">
                  <v-icon class="mr-2" color="primary">mdi-clock-outline</v-icon>
                  Облік часу
                  <v-spacer />
                  <v-chip color="primary" variant="tonal" size="small" class="mr-2">
                    {(t.totalHours ?? 0).toFixed(1)} / {t.estimatedHours != null ? `${t.estimatedHours}г` : '∞'}
                  </v-chip>
                  <v-btn
                    size="small"
                    color="primary"
                    prepend-icon="mdi-plus"
                    onClick={openTimeLog}
                  >
                    Додати
                  </v-btn>
                </v-card-title>

                {t.estimatedHours != null && (
                  <div class="px-4 pt-2">
                    <v-progress-linear
                      model-value={Math.min(100, ((t.totalHours ?? 0) / t.estimatedHours) * 100)}
                      color={t.totalHours > t.estimatedHours ? 'error' : 'primary'}
                      rounded
                      height={6}
                    />
                  </div>
                )}

                <v-list density="compact" class="pa-2">
                  {(t.timeLogs ?? []).length === 0 && (
                    <v-list-item>
                      <v-list-item-title class="text-disabled text-caption">Немає записів</v-list-item-title>
                    </v-list-item>
                  )}
                  {(t.timeLogs ?? []).map((log: any) => (
                    <v-list-item key={log.id} class="rounded mb-1">
                      {{
                        prepend: () => (
                          <v-avatar color="primary" size="32" variant="tonal">
                            <span class="text-caption">{log.user.name.charAt(0).toUpperCase()}</span>
                          </v-avatar>
                        ),
                        default: () => (
                          <div>
                            <div class="text-body-2 font-weight-medium">{log.user.name}</div>
                            {log.description && (
                              <div class="text-caption text-disabled">{log.description}</div>
                            )}
                          </div>
                        ),
                        append: () => (
                          <div class="d-flex align-center gap-2">
                            <div class="text-right">
                              <div class="text-body-2 font-weight-bold">{log.hours}г</div>
                              <div class="text-caption text-disabled">{formatDate(log.date)}</div>
                            </div>
                            {canEditTimeLog(log) && (
                              <v-btn
                                icon="mdi-delete"
                                size="x-small"
                                variant="text"
                                color="error"
                                onClick={() => deleteTimeLog(log.id)}
                              />
                            )}
                          </div>
                        ),
                      }}
                    </v-list-item>
                  ))}
                </v-list>
              </v-card>

              {/* Attachments */}
              <v-card class="mb-4">
                <v-card-title class="pa-4 pb-0 d-flex align-center">
                  <v-icon class="mr-2" color="primary">mdi-paperclip</v-icon>
                  Файли
                  <v-chip size="small" class="ml-2" variant="tonal">
                    {(t.attachments ?? []).length}
                  </v-chip>
                  <v-spacer />
                  <v-btn
                    size="small"
                    color="primary"
                    prepend-icon="mdi-upload"
                    loading={uploading.value}
                    onClick={triggerUpload}
                  >
                    Завантажити
                  </v-btn>
                  <input
                    ref={uploadInput}
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
                    style="display:none"
                    onChange={handleFileChange}
                  />
                </v-card-title>
                <v-card-text class="pa-3 pt-2">
                  {uploadError.value && (
                    <v-alert type="error" variant="tonal" density="compact" class="mb-3" closable onMousedown={() => (uploadError.value = '')}>
                      {uploadError.value}
                    </v-alert>
                  )}

                  {(t.attachments ?? []).length === 0 && (
                    <div
                      class="text-center text-disabled text-caption pa-6 rounded"
                      style="border: 2px dashed rgba(128,128,128,0.3); cursor:pointer"
                      onClick={triggerUpload}
                    >
                      <v-icon size="32" class="mb-2 d-block" style="opacity:0.4">mdi-cloud-upload-outline</v-icon>
                      Натисніть або перетягніть файли сюди
                    </div>
                  )}

                  {(t.attachments ?? []).length > 0 && (
                    <div class="d-flex flex-wrap" style="gap:10px">
                      {(t.attachments ?? []).map((att: any) => (
                        <v-card
                          key={att.id}
                          variant="outlined"
                          width={isImage(att.mimeType) ? 130 : undefined}
                          style={isImage(att.mimeType) ? 'flex-shrink:0' : 'min-width:220px; flex:1'}
                        >
                          {isImage(att.mimeType) && (
                              <div
                              style="height:90px; overflow:hidden; cursor:zoom-in; background:#111"
                              onClick={() => { imagePreview.value = { url: attachmentFileUrl(att.id), name: att.filename }; showImagePreview.value = true }}
                            >
                              <img
                                src={attachmentFileUrl(att.id)}
                                alt={att.filename}
                                style="width:100%; height:100%; object-fit:cover"
                              />
                            </div>
                          )}
                          {isVideo(att.mimeType) && (
                            <div style="height:90px; overflow:hidden; background:#111">
                              <video
                                src={attachmentFileUrl(att.id)}
                                style="width:100%; height:100%; object-fit:cover"
                                controls={false}
                                muted
                              />
                            </div>
                          )}
                          <div class="pa-2">
                            <div class="d-flex align-center gap-1">
                              <v-icon size="18" color={fileColor(att.mimeType)}>{fileIcon(att.mimeType)}</v-icon>
                              <span
                                class="text-caption font-weight-medium text-truncate"
                                style="flex:1; max-width:160px"
                                title={att.filename}
                              >
                                {att.filename}
                              </span>
                            </div>
                            <div class="d-flex align-center mt-1">
                              <span class="text-caption text-disabled">{formatSize(att.size)}</span>
                              <v-spacer />
                              <v-btn
                                icon="mdi-download"
                                size="x-small"
                                variant="text"
                                href={attachmentFileUrl(att.id)}
                                download={att.filename}
                                onClick={(e: Event) => e.stopPropagation()}
                              />
                              {canDeleteAttachment(att) && (
                                <v-btn
                                  icon="mdi-delete"
                                  size="x-small"
                                  variant="text"
                                  color="error"
                                  onClick={() => deleteAttachment(att.id)}
                                />
                              )}
                            </div>
                          </div>
                        </v-card>
                      ))}
                    </div>
                  )}
                </v-card-text>
              </v-card>

              {/* Image preview dialog */}
              <v-dialog v-model={showImagePreview.value} max-width={900}>
                <v-card>
                  <v-card-title class="pa-3 d-flex align-center">
                    <span class="text-body-2 text-truncate" style="flex:1">{imagePreview.value?.name}</span>
                    <v-btn icon="mdi-close" variant="text" size="small" onClick={() => (showImagePreview.value = false)} />
                  </v-card-title>
                  <v-card-text class="pa-0 text-center" style="background:#000">
                    {imagePreview.value && (
                      <img
                        src={imagePreview.value.url}
                        alt={imagePreview.value.name}
                        style="max-width:100%; max-height:75vh; object-fit:contain"
                      />
                    )}
                  </v-card-text>
                </v-card>
              </v-dialog>

              {/* Comments */}
              <v-card>
                <v-card-title class="pa-4 pb-0 d-flex align-center">
                  <v-icon class="mr-2" color="primary">mdi-comment-outline</v-icon>
                  Коментарі
                  <v-chip size="small" class="ml-2" variant="tonal">
                    {(t.comments ?? []).length}
                  </v-chip>
                </v-card-title>
                <v-card-text class="pa-4">
                  {commentError.value && (
                    <v-alert type="error" variant="tonal" class="mb-3">
                      <div class="d-flex align-center" style="gap: 8px">
                        <span style="flex: 1">{commentError.value}</span>
                        <v-btn
                          size="x-small"
                          icon="mdi-close"
                          variant="text"
                          onClick={() => (commentError.value = '')}
                        />
                      </div>
                    </v-alert>
                  )}

                  <div class="d-flex flex-column gap-3 mb-4">
                    {(t.comments ?? []).map((c: any) => (
                      <div
                        key={c.id}
                        class="d-flex gap-3"
                        style={{
                          borderLeft: c.parentId ? '2px solid rgba(128,128,128,0.35)' : 'none',
                          marginLeft: c.parentId ? '0' : '0',
                          paddingLeft: c.parentId ? '10px' : '0',
                        }}
                      >
                        <v-avatar color="secondary" size="36" variant="tonal">
                          <span class="text-caption">{c.user.name.charAt(0).toUpperCase()}</span>
                        </v-avatar>
                        <v-card variant="tonal" class="pa-3 flex-grow-1">
                          <div class="d-flex flex-wrap align-center justify-space-between gap-1 mb-1">
                            <div>
                              <span class="text-body-2 font-weight-bold">{c.user.name}</span>
                              <span class="text-caption text-disabled ml-2">
                                {formatDateTime(c.createdAt)}
                                {isCommentEdited(c) && ' · (ред.)'}
                              </span>
                            </div>
                            {canMutateComment(c) && !editingId.value && (
                              <div class="d-flex flex-wrap" style="gap:4px">
                                <v-btn
                                  size="x-small"
                                  variant="text"
                                  onClick={() => startReplyTo(c)}
                                >
                                  Відповісти
                                </v-btn>
                                <v-btn
                                  size="x-small"
                                  variant="text"
                                  onClick={() => startEditComment(c)}
                                >
                                  Редагувати
                                </v-btn>
                                <v-btn
                                  size="x-small"
                                  variant="text"
                                  color="error"
                                  onClick={() => deleteTaskComment(c)}
                                >
                                  Видалити
                                </v-btn>
                              </div>
                            )}
                          </div>
                          {c.parent && (
                            <div class="text-caption text-medium-emphasis mb-2" style="opacity:0.9">
                              <v-icon size="12" class="mr-1">mdi-reply</v-icon>
                              {c.parent.user.name} · {formatDateTime(c.parent.createdAt)}
                            </div>
                          )}
                          <div class="mb-1">
                            <TaskCommentContent html={c.content} />
                          </div>
                          {c.attachments?.length > 0 && (
                            <div class="d-flex flex-wrap mt-2" style="gap:8px">
                              {c.attachments.map((att: any) => (
                                <v-card
                                  key={att.id}
                                  variant="outlined"
                                  class="d-flex align-center"
                                  style={{ minWidth: 160, maxWidth: 220 }}
                                >
                                  {isImage(att.mimeType) && (
                                    <div
                                      style="width: 56px; height: 56px; flex-shrink: 0; cursor: pointer; background: #111; overflow: hidden; border-radius: 4px 0 0 4px"
                                      onClick={() => {
                                        imagePreview.value = { url: attachmentFileUrl(att.id), name: att.filename }
                                        showImagePreview.value = true
                                      }}
                                    >
                                      <img
                                        src={attachmentFileUrl(att.id)}
                                        alt={att.filename}
                                        style="width: 100%; height: 100%; object-fit: cover"
                                      />
                                    </div>
                                  )}
                                  <div class="px-2 py-1" style="flex: 1; minWidth: 0">
                                    <div class="d-flex align-center" style="gap: 4px">
                                      <v-icon size="16" color={fileColor(att.mimeType)}>{fileIcon(att.mimeType)}</v-icon>
                                      <a
                                        href={attachmentFileUrl(att.id)}
                                        download={att.filename}
                                        class="text-caption text-truncate d-inline-block"
                                        style="maxWidth: 120px; color: inherit; text-decoration: none"
                                        title={att.filename}
                                        onClick={(e: Event) => e.stopPropagation()}
                                      >
                                        {att.filename}
                                      </a>
                                    </div>
                                    <div class="text-caption text-disabled">{formatSize(att.size)}</div>
                                  </div>
                                </v-card>
                              ))}
                            </div>
                          )}
                        </v-card>
                      </div>
                    ))}
                    {(t.comments ?? []).length === 0 && (
                      <div class="text-caption text-disabled text-center py-2">Немає коментарів</div>
                    )}
                  </div>

                  {replyingTo.value && (
                    <v-alert
                      class="mb-2"
                      density="compact"
                      type="info"
                      variant="tonal"
                    >
                      <div class="d-flex align-center" style="gap:8px; flex-wrap: wrap">
                        <span class="text-caption">
                          Відповідь: {replyingTo.value.name} · {formatDateTime(replyingTo.value.at)}
                        </span>
                        <v-spacer style="min-width: 8px" />
                        <v-btn size="x-small" variant="text" onClick={() => (replyingTo.value = null)}>
                          Скасувати
                        </v-btn>
                      </div>
                    </v-alert>
                  )}
                  {editingId.value && (
                    <v-alert
                      class="mb-2"
                      density="compact"
                      type="info"
                      variant="tonal"
                    >
                      <span class="text-caption">Режим редагування. Натисніть «Скасувати зміни», щоб вийти.</span>
                      <v-btn
                        class="ml-2"
                        size="x-small"
                        variant="text"
                        onClick={clearCommentComposer}
                      >
                        Скасувати
                      </v-btn>
                    </v-alert>
                  )}

                  <div class="d-flex flex-column" style="gap: 8px">
                    {commentClient.value && (
                      <div key={commentEditorKey.value}>
                        <TaskCommentEditor
                          modelValue={commentHtml.value}
                          onUpdate:modelValue={(v: string) => (commentHtml.value = v)}
                          onUpdate:isTextEmpty={(e: boolean) => (commentTextEmpty.value = e)}
                          disabled={commentSaving.value}
                          placeholder="Написати коментар…"
                        />
                      </div>
                    )}
                    {!commentClient.value && <v-skeleton-loader type="article" />}

                    <div class="d-flex flex-wrap align-center" style="gap: 6px">
                      <v-btn
                        size="x-small"
                        variant="outlined"
                        prepend-icon="mdi-paperclip"
                        loading={commentFileUploading.value}
                        onClick={triggerCommentFile}
                        disabled={commentSaving.value}
                      >
                        Вкладення
                      </v-btn>
                      <input
                        ref={commentFileInput}
                        type="file"
                        multiple
                        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
                        style="display: none"
                        onChange={onCommentFileInput}
                      />
                    </div>
                    {pendingCommentFiles.value.length > 0 && (
                      <div class="d-flex flex-wrap align-center" style="gap: 6px">
                        {pendingCommentFiles.value.map((pf) => (
                          <div
                            key={pf.id}
                            class="d-inline-flex align-center text-caption"
                            style="border:1px solid rgba(128,128,128,0.35); border-radius: 9999px; padding: 2px 4px 2px 8px; gap: 2px; max-width: 240px"
                          >
                            <span class="text-truncate" style="flex:1" title={pf.filename}>
                              {pf.filename}
                            </span>
                            <v-btn
                              size="x-small"
                              icon="mdi-close"
                              variant="text"
                              density="compact"
                              onClick={() => deletePendingByUnlink(pf.id)}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div class="d-flex align-center justify-end" style="gap: 8px">
                      {editingId.value && (
                        <v-btn variant="text" size="small" onClick={clearCommentComposer}>
                          Скасувати зміни
                        </v-btn>
                      )}
                      <v-btn
                        color="primary"
                        prepend-icon={editingId.value ? 'mdi-content-save' : 'mdi-send'}
                        loading={commentSaving.value}
                        disabled={commentTextEmpty.value}
                        onClick={submitComment}
                      >
                        {editingId.value ? 'Зберегти' : 'Надіслати'}
                      </v-btn>
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </div>

            {/* Sidebar */}
            <div style="width:280px; flex-shrink:0">
              <v-card>
                <v-list-subheader class="px-4 pt-3">ДЕТАЛІ</v-list-subheader>
                <v-divider />
                <div class="pa-3">
                  {[
                    { icon: 'mdi-account-circle', label: 'Виконавець', value: t.assignee?.name ?? 'Не призначено' },
                    { icon: 'mdi-account-plus', label: 'Створив', value: t.createdBy?.name },
                    ...(t.object ? [{ icon: 'mdi-office-building-outline', label: 'Обʼєкт', value: t.object.name }] : []),
                    { icon: 'mdi-calendar-plus', label: 'Створено', value: formatDate(t.createdAt) },
                    ...(t.dueDate ? [{ icon: 'mdi-calendar-clock', label: 'Дедлайн', value: formatDate(t.dueDate), error: isOverdue() }] : []),
                    { icon: 'mdi-clock-outline', label: 'Витрачено', value: `${(t.totalHours ?? 0).toFixed(1)}г` },
                    ...(t.estimatedHours != null ? [{ icon: 'mdi-clock-check-outline', label: 'Оцінка', value: `${t.estimatedHours}г` }] : []),
                  ].map((row: any, i: number) => (
                    <div key={i} class="d-flex align-center py-2 px-1" style="gap:10px; border-bottom: 1px solid rgba(128,128,128,0.1)">
                      <v-icon size="18" color={row.error ? 'error' : 'medium-emphasis'}>{row.icon}</v-icon>
                      <span class="text-body-2 text-medium-emphasis" style="flex:1; white-space:nowrap">{row.label}</span>
                      <span class={`text-body-2 font-weight-medium text-right ${row.error ? 'text-error' : ''}`} style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title={row.value}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </v-card>
            </div>
          </div>

          {/* Edit dialog */}
          <v-dialog v-model={editDialog.value} max-width={560}>
            <v-card>
              <v-card-title class="pa-4">Редагувати завдання</v-card-title>
              <v-card-text class="pa-4 pt-0">
                {editError.value && <v-alert type="error" variant="tonal" class="mb-3">{editError.value}</v-alert>}
                <v-text-field v-model={editForm.title} label="Назва *" class="mb-3" />
                <v-textarea v-model={editForm.description} label="Опис" rows={3} class="mb-3" />
                <div class="d-flex gap-4 mb-3">
                  <v-select
                    v-model={editForm.status}
                    label="Статус"
                    items={STATUSES.map((s) => ({ value: s.value, title: s.label }))}
                    style="flex:1"
                  />
                  <v-select
                    v-model={editForm.priority}
                    label="Пріоритет"
                    items={PRIORITIES.map((p) => ({ value: p.value, title: p.label }))}
                    style="flex:1"
                  />
                </div>
                <div class="d-flex gap-4 mb-3">
                  <v-select
                    v-model={editForm.assignedToId}
                    label="Виконавець"
                    items={[{ value: '', title: 'Не призначено' }, ...users.value.map((u: any) => ({ value: u.id, title: u.name }))]}
                    style="flex:1"
                  />
                  <v-select
                    v-model={editForm.objectId}
                    label="Обʼєкт"
                    items={[{ value: '', title: 'Без обʼєкту' }, ...objects.value.map((o: any) => ({ value: o.id, title: o.name }))]}
                    style="flex:1"
                  />
                </div>
                <div class="d-flex gap-4">
                  <v-text-field
                    v-model={editForm.dueDate}
                    label="Дедлайн"
                    type="date"
                    style="flex:1"
                  />
                  <v-text-field
                    v-model={editForm.estimatedHours}
                    label="Оцінка (год.)"
                    type="number"
                    min="0"
                    step="0.5"
                    style="flex:1"
                  />
                </div>
              </v-card-text>
              <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="outlined" onClick={() => (editDialog.value = false)}>Скасувати</v-btn>
                <v-btn color="primary" variant="elevated" loading={editSaving.value} disabled={!editForm.title.trim()} onClick={saveEdit}>
                  Зберегти
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          {/* Sub-task create dialog */}
          <v-dialog v-model={subTaskDialog.value} max-width={480}>
            <v-card>
              <v-card-title class="pa-4">Нове підзавдання</v-card-title>
              <v-card-text class="pa-4 pt-0">
                {subTaskError.value && (
                  <v-alert type="error" variant="tonal" class="mb-3">{subTaskError.value}</v-alert>
                )}
                <v-text-field v-model={subTaskForm.title} label="Назва *" class="mb-4" autofocus />
                <div class="d-flex mb-2" style="gap:16px">
                  <v-select
                    v-model={subTaskForm.priority}
                    label="Пріоритет"
                    items={PRIORITIES.map((p) => ({ value: p.value, title: p.label }))}
                    style="flex:1"
                  />
                  <v-select
                    v-model={subTaskForm.assignedToId}
                    label="Виконавець"
                    items={[{ value: '', title: 'Не призначено' }, ...users.value.map((u: any) => ({ value: u.id, title: u.name }))]}
                    style="flex:1"
                  />
                </div>
              </v-card-text>
              <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="outlined" onClick={() => (subTaskDialog.value = false)}>Скасувати</v-btn>
                <v-btn
                  color="primary"
                  variant="elevated"
                  loading={subTaskSaving.value}
                  disabled={!subTaskForm.title.trim()}
                  onClick={saveSubTask}
                >
                  Створити
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          {/* Time log dialog */}
          <v-dialog v-model={timeLogDialog.value} max-width={420}>
            <v-card>
              <v-card-title class="pa-4">Додати час</v-card-title>
              <v-card-text class="pa-4 pt-0">
                {timeLogError.value && <v-alert type="error" variant="tonal" class="mb-3">{timeLogError.value}</v-alert>}
                <v-text-field
                  v-model={timeLogForm.hours}
                  label="Кількість годин *"
                  type="number"
                  min="0.5"
                  step="0.5"
                  class="mb-3"
                />
                <v-text-field
                  v-model={timeLogForm.date}
                  label="Дата"
                  type="date"
                  class="mb-3"
                />
                <v-textarea v-model={timeLogForm.description} label="Опис роботи" rows={2} />
              </v-card-text>
              <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="outlined" onClick={() => (timeLogDialog.value = false)}>Скасувати</v-btn>
                <v-btn
                  color="primary"
                  variant="elevated"
                  loading={timeLogSaving.value}
                  disabled={!timeLogForm.hours || Number(timeLogForm.hours) <= 0}
                  onClick={saveTimeLog}
                >
                  Зберегти
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </div>
      )
    }
  },
})
