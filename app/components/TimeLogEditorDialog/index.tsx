import type { PropType } from 'vue'

/**
 * Спільний діалог створення/редагування запису журналу робіт.
 * Використовується на сторінці журналу та на сторінці конкретного дня.
 */
export default defineComponent({
  name: 'TimeLogEditorDialog',
  props: {
    /** Чи відкритий діалог (v-model:open). */
    open: { type: Boolean, default: false },
    /** Запис для редагування; null — режим створення. */
    log: { type: Object as PropType<any>, default: null },
    /** Дата за замовчуванням для нового запису (YYYY-MM-DD). */
    defaultDate: { type: String, default: '' },
  },
  emits: ['update:open', 'saved'],
  setup(props, { emit }) {
    const toast = useToast()
    const dialogModel = computed({
      get: () => props.open,
      set: (v: boolean) => emit('update:open', v),
    })

    const { data: usersData } = useFetch('/api/users/list')
    const users = computed(() => (usersData.value as any[]) ?? [])

    const { data: objectsData } = useFetch('/api/objects')
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])

    const { data: warehousesData } = useFetch('/api/warehouses')
    const warehouses = computed(() => (warehousesData.value as any)?.warehouses ?? [])

    const todayIso = () => new Date().toISOString().slice(0, 10)

    const form = reactive({
      userId: '' as string,
      locationType: 'object' as 'object' | 'warehouse',
      objectId: '' as string,
      warehouseId: '' as string,
      taskId: '' as string,
      hours: '' as string,
      description: '' as string,
      date: todayIso(),
    })

    const syncingForm = ref(false)
    const saving = ref(false)
    const error = ref('')

    const editingId = computed<string | null>(() => props.log?.id ?? null)

    const { data: tasksData, pending: tasksPending } = useAsyncData(
      () => `tle-tasks-${form.objectId || 'none'}`,
      async () => {
        if (!form.objectId) return { tasks: [] as any[] }
        return await $fetch<{ tasks: any[] }>('/api/tasks', { query: { objectId: form.objectId } })
      },
      { watch: [() => form.objectId] },
    )
    const tasks = computed(() => tasksData.value?.tasks ?? [])

    const taskItems = computed(() => [
      { value: '', title: 'Без завдання (лише обʼєкт)' },
      ...tasks.value.map((t: any) => ({
        value: t.id,
        title: t.parentId ? `↳ ${t.title}` : t.title,
      })),
    ])

    watch(
      () => form.objectId,
      () => {
        if (!syncingForm.value) form.taskId = ''
      },
    )

    watch(
      () => form.locationType,
      () => {
        if (syncingForm.value) return
        if (form.locationType === 'warehouse') {
          form.objectId = ''
          form.taskId = ''
        }
        else {
          form.warehouseId = ''
        }
      },
    )

    function resetForCreate() {
      syncingForm.value = true
      form.userId = ''
      form.locationType = 'object'
      form.objectId = ''
      form.warehouseId = ''
      form.taskId = ''
      form.hours = ''
      form.description = ''
      form.date = props.defaultDate || todayIso()
      nextTick(() => {
        syncingForm.value = false
      })
    }

    function fillFromLog(item: any) {
      syncingForm.value = true
      form.userId = item.userId
      form.locationType = item.warehouse ? 'warehouse' : 'object'
      form.objectId = item.object?.id || item.task?.objectId || ''
      form.warehouseId = item.warehouse?.id || ''
      form.taskId = item.taskId || ''
      form.hours = String(item.hours)
      form.description = item.description || ''
      form.date = new Date(item.date).toISOString().slice(0, 10)
      nextTick(() => {
        syncingForm.value = false
      })
    }

    watch(
      () => props.open,
      (isOpen) => {
        if (!isOpen) return
        error.value = ''
        if (props.log) fillFromLog(props.log)
        else resetForCreate()
      },
    )

    const canSubmit = computed(
      () => !!form.userId && form.hours !== '' && Number(form.hours) > 0,
    )

    async function submit() {
      saving.value = true
      error.value = ''
      try {
        const isWarehouse = form.locationType === 'warehouse'
        const body = {
          userId: form.userId,
          objectId: isWarehouse ? null : form.objectId || null,
          taskId: isWarehouse ? null : form.taskId || null,
          warehouseId: isWarehouse ? form.warehouseId || null : null,
          hours: Number(form.hours),
          description: form.description.trim() || null,
          date: form.date || null,
        }
        const isEdit = !!editingId.value
        if (editingId.value) {
          await $fetch(`/api/time-logs/${editingId.value}`, { method: 'PUT', body })
        }
        else {
          await $fetch('/api/time-logs', { method: 'POST', body })
        }
        emit('saved', isEdit ? 'updated' : 'created')
        dialogModel.value = false
        toast.success(isEdit ? 'Запис журналу оновлено' : 'Запис журналу створено')
      }
      catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
        toast.error(error.value)
      }
      finally {
        saving.value = false
      }
    }

    return () => (
      <v-dialog v-model={dialogModel.value} max-width={520}>
        <v-card>
          <v-card-title class="pa-4">
            {editingId.value ? 'Редагувати запис у журналі' : 'Новий запис у журналі'}
          </v-card-title>
          <v-card-text class="pa-4 pt-0">
            {error.value && (
              <v-alert type="error" variant="tonal" class="mb-3" closable onClick:close={() => (error.value = '')}>
                {error.value}
              </v-alert>
            )}

            <v-select
              v-model={form.userId}
              label="Працівник *"
              items={users.value.map((u: any) => ({ value: u.id, title: u.name }))}
              item-title="title"
              item-value="value"
              class="mb-3"
              hide-details="auto"
            />

            <div class="text-caption text-medium-emphasis mb-1">Де виконувалась робота</div>
            <v-btn-toggle
              v-model={form.locationType}
              mandatory
              divided
              variant="outlined"
              density="comfortable"
              class="mb-3"
            >
              <v-btn value="object" prepend-icon="mdi-office-building-outline" size="small">
                Обʼєкт
              </v-btn>
              <v-btn value="warehouse" prepend-icon="mdi-warehouse" size="small">
                Склад
              </v-btn>
            </v-btn-toggle>

            {form.locationType === 'object' ? (
              <>
                <v-select
                  v-model={form.objectId}
                  label="Обʼєкт"
                  items={objects.value.map((o: any) => ({ value: o.id, title: o.name }))}
                  item-title="title"
                  item-value="value"
                  clearable
                  class="mb-3"
                  hide-details="auto"
                />
                <v-select
                  v-model={form.taskId}
                  label="Завдання (необовʼязково)"
                  items={taskItems.value}
                  item-title="title"
                  item-value="value"
                  disabled={!form.objectId}
                  loading={tasksPending.value}
                  hint={form.objectId ? 'Усі завдання та підзавдання на обраному обʼєкті' : 'Спочатку оберіть обʼєкт'}
                  persistent-hint
                  class="mb-3"
                />
              </>
            ) : (
              <v-select
                v-model={form.warehouseId}
                label="Склад"
                items={warehouses.value.map((w: any) => ({ value: w.id, title: w.name }))}
                item-title="title"
                item-value="value"
                clearable
                class="mb-3"
                hide-details="auto"
              />
            )}

            <v-text-field
              v-model={form.hours}
              label="Години *"
              type="number"
              min="0.25"
              step="0.25"
              class="mb-3"
              hide-details="auto"
            />

            <v-text-field v-model={form.date} label="Дата" type="date" class="mb-3" hide-details="auto" />

            <v-textarea v-model={form.description} label="Опис робіт" rows={3} hide-details="auto" />
          </v-card-text>
          <v-card-actions class="px-4 pb-4">
            <v-btn variant="outlined" onClick={() => (dialogModel.value = false)}>Скасувати</v-btn>
            <v-spacer />
            <v-btn
              color="primary"
              variant="elevated"
              loading={saving.value}
              disabled={!canSubmit.value}
              onClick={submit}
            >
              Зберегти
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    )
  },
})
