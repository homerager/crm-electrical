interface DocTypeMeta {
  title: string
  value: 'estimate' | 'act' | 'contract'
  icon: string
  color: string
  description: string
}

const DOC_TYPES: DocTypeMeta[] = [
  { title: 'Кошторис', value: 'estimate', icon: 'mdi-calculator-variant', color: 'primary', description: 'Кошторис на виконання робіт з переліком матеріалів та трудовитрат' },
  { title: 'Акт виконаних робіт', value: 'act', icon: 'mdi-clipboard-check-outline', color: 'success', description: 'Акт прийому-передачі виконаних робіт з деталізацією' },
  { title: 'Договір', value: 'contract', icon: 'mdi-file-sign', color: 'warning', description: 'Договір на виконання будівельно-монтажних робіт' },
]

export default defineComponent({
  name: 'DocumentsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Документи' })

    const { isPrivileged } = useAuth()
    const toast = useToast()

    const { data, refresh, pending } = useFetch('/api/documents')
    const { data: objectsData } = useFetch('/api/objects')
    const { data: clientsData } = useFetch('/api/clients')

    const documents = computed(() => (data.value as any)?.documents ?? [])
    const objects = computed(() => (objectsData.value as any)?.objects ?? [])
    const clients = computed(() => (clientsData.value as any)?.clients ?? [])

    const search = ref('')
    const typeFilter = ref<string | null>(null)
    const filtered = computed(() => {
      let list = documents.value as any[]
      if (typeFilter.value) list = list.filter((d) => d.type === typeFilter.value)
      if (search.value) {
        const q = search.value.toLowerCase()
        list = list.filter((d) =>
          d.number.toLowerCase().includes(q)
          || (d.objectName || '').toLowerCase().includes(q)
          || (d.clientName || '').toLowerCase().includes(q),
        )
      }
      return list
    })

    function typeMeta(type: string) {
      return DOC_TYPES.find((t) => t.value === type)
    }

    function fmtMoney(n: number) {
      return Number(n || 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    function fmtDate(d: string) {
      return new Date(d).toLocaleDateString('uk-UA')
    }

    /* ───────── Create flow ───────── */

    const createDialog = ref(false)
    const createStep = ref(1)
    const creating = ref(false)
    const createError = ref('')

    const createForm = reactive({
      type: '' as '' | 'estimate' | 'act' | 'contract',
      objectId: '',
      clientId: '',
      number: '',
      date: new Date().toISOString().split('T')[0],
      vatPercent: null as number | null,
    })

    const isContract = computed(() => createForm.type === 'contract')
    const isEstimateOrAct = computed(() => createForm.type === 'estimate' || createForm.type === 'act')

    watch(() => createForm.objectId, (id) => {
      if (!id) return
      const obj = objects.value.find((o: any) => o.id === id)
      if (obj?.clientId) createForm.clientId = obj.clientId
    })

    function openCreate() {
      createForm.type = ''
      createForm.objectId = ''
      createForm.clientId = ''
      createForm.number = ''
      createForm.date = new Date().toISOString().split('T')[0]
      createForm.vatPercent = null
      createError.value = ''
      createStep.value = 1
      createDialog.value = true
    }

    function pickType(type: 'estimate' | 'act' | 'contract') {
      createForm.type = type
      createStep.value = 2
    }

    async function submitCreate() {
      createError.value = ''
      if (!createForm.objectId) { createError.value = 'Оберіть обʼєкт'; return }
      if (!createForm.number.trim()) { createError.value = 'Вкажіть номер документа'; return }
      if (!createForm.date) { createError.value = 'Вкажіть дату'; return }
      if (isContract.value && !createForm.clientId) {
        const obj = objects.value.find((o: any) => o.id === createForm.objectId)
        if (!obj?.clientId) { createError.value = 'Для договору потрібен клієнт (замовник)'; return }
      }

      creating.value = true
      try {
        const res = await $fetch('/api/documents', {
          method: 'POST',
          body: {
            type: createForm.type,
            objectId: createForm.objectId,
            clientId: createForm.clientId || undefined,
            number: createForm.number.trim(),
            date: createForm.date,
            vatPercent: createForm.vatPercent,
          },
        }) as any
        createDialog.value = false
        toast.success('Документ створено')
        await navigateTo(`/documents/${res.document.id}`)
      } catch (e: any) {
        createError.value = e?.data?.statusMessage || e?.message || 'Помилка створення документа'
        toast.error(createError.value)
      } finally {
        creating.value = false
      }
    }

    /* ───────── Delete flow ───────── */

    const deleteDialog = ref(false)
    const deleteItem = ref<any>(null)
    const deleteError = ref('')
    const deleting = ref(false)

    function openDelete(item: any) {
      deleteItem.value = item
      deleteError.value = ''
      deleteDialog.value = true
    }
    async function confirmDelete() {
      if (!deleteItem.value) return
      deleting.value = true
      deleteError.value = ''
      try {
        await $fetch(`/api/documents/${deleteItem.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
        toast.success('Документ видалено')
      } catch (e: any) {
        deleteError.value = e?.data?.statusMessage || 'Помилка видалення'
        toast.error(deleteError.value)
      } finally {
        deleting.value = false
      }
    }

    /* ───────── Download PDF ───────── */

    const downloadingId = ref<string | null>(null)
    async function downloadPdf(item: any) {
      downloadingId.value = item.id
      try {
        const blob = await $fetch(`/api/documents/${item.id}/pdf`, { responseType: 'blob' }) as Blob
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${typeMeta(item.type)?.title || 'Документ'}-${item.number}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } catch (e: any) {
        alert(e?.data?.statusMessage || 'Помилка генерації PDF')
      } finally {
        downloadingId.value = null
      }
    }

    const headers = [
      { title: 'Тип', key: 'type', width: 90 },
      { title: 'Номер', key: 'number', width: 130 },
      { title: 'Дата', key: 'date', width: 110 },
      { title: 'Обʼєкт', key: 'objectName' },
      { title: 'Замовник', key: 'clientName' },
      { title: 'Сума', key: 'total', align: 'end' as const, width: 140 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 150 },
    ]

    return () => (
      <div>
        <div class="page-toolbar">
          <v-icon icon="mdi-file-document-multiple-outline" size="28" class="mr-2" />
          <div class="text-h5 font-weight-bold">Документи</div>
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
            Створити документ
          </v-btn>
        </div>

        <v-card>
          <v-card-text class="d-flex flex-wrap gap-3 pb-0">
            <v-text-field
              v-model={search.value}
              label="Пошук за номером, обʼєктом, замовником"
              prepend-inner-icon="mdi-magnify"
              clearable
              hide-details
              density="compact"
              style="max-width:360px"
            />
            <v-select
              v-model={typeFilter.value}
              label="Тип"
              items={DOC_TYPES}
              item-title="title"
              item-value="value"
              clearable
              hide-details
              density="compact"
              style="max-width:220px"
            />
          </v-card-text>

          <v-data-table
            headers={headers}
            items={filtered.value}
            loading={pending.value}
            hover
            items-per-page={20}
            no-data-text="Ще немає збережених документів"
          >
            {{
              'item.type': ({ item }: any) => {
                const m = typeMeta(item.type)
                return (
                  <v-tooltip text={m?.title}>
                    {{
                      activator: ({ props }: any) => (
                        <v-avatar {...props} color={m?.color} variant="tonal" size={34}>
                          <v-icon icon={m?.icon} size={18} />
                        </v-avatar>
                      ),
                    }}
                  </v-tooltip>
                )
              },
              'item.number': ({ item }: any) => (
                <router-link to={`/documents/${item.id}`} class="text-primary text-decoration-none font-weight-medium">
                  №{item.number}
                </router-link>
              ),
              'item.date': ({ item }: any) => fmtDate(item.date),
              'item.objectName': ({ item }: any) => item.objectName || <span class="text-medium-emphasis">—</span>,
              'item.clientName': ({ item }: any) => item.clientName || <span class="text-medium-emphasis">—</span>,
              'item.total': ({ item }: any) => (
                <span class="font-weight-bold">{fmtMoney(item.total)} грн</span>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end">
                  <v-tooltip text="Завантажити PDF">
                    {{
                      activator: ({ props }: any) => (
                        <v-btn
                          {...props}
                          icon="mdi-file-pdf-box"
                          variant="text"
                          size="small"
                          color="error"
                          loading={downloadingId.value === item.id}
                          onClick={() => downloadPdf(item)}
                        />
                      ),
                    }}
                  </v-tooltip>
                  <v-tooltip text="Редагувати">
                    {{
                      activator: ({ props }: any) => (
                        <v-btn
                          {...props}
                          icon="mdi-pencil"
                          variant="text"
                          size="small"
                          color="primary"
                          to={`/documents/${item.id}`}
                        />
                      ),
                    }}
                  </v-tooltip>
                  {isPrivileged.value && (
                    <v-tooltip text="Видалити">
                      {{
                        activator: ({ props }: any) => (
                          <v-btn
                            {...props}
                            icon="mdi-delete"
                            variant="text"
                            size="small"
                            color="error"
                            onClick={() => openDelete(item)}
                          />
                        ),
                      }}
                    </v-tooltip>
                  )}
                </div>
              ),
            }}
          </v-data-table>
        </v-card>

        {/* Create dialog */}
        <v-dialog v-model={createDialog.value} max-width={createStep.value === 1 ? 900 : 560} scrollable>
          <v-card>
            <v-card-title class="d-flex align-center">
              {createStep.value === 2 && (
                <v-btn variant="text" icon="mdi-arrow-left" size="small" class="mr-1" onClick={() => (createStep.value = 1)} />
              )}
              <span>{createStep.value === 1 ? 'Новий документ — оберіть тип' : `Новий документ: ${typeMeta(createForm.type)?.title}`}</span>
              <v-spacer />
              <v-btn variant="text" icon="mdi-close" size="small" onClick={() => (createDialog.value = false)} />
            </v-card-title>
            <v-divider />
            <v-card-text>
              {createError.value && (
                <v-alert type="error" variant="tonal" density="compact" class="mb-4">{createError.value}</v-alert>
              )}

              {createStep.value === 1 && (
                <v-row>
                  {DOC_TYPES.map((dt) => (
                    <v-col key={dt.value} cols={12} sm={4}>
                      <v-card class="pa-4 cursor-pointer" variant="outlined" hover onClick={() => pickType(dt.value)}>
                        <div class="d-flex align-center mb-3">
                          <v-avatar color={dt.color} variant="tonal" size={44} class="mr-3">
                            <v-icon icon={dt.icon} size={22} />
                          </v-avatar>
                          <div class="text-subtitle-1 font-weight-medium">{dt.title}</div>
                        </div>
                        <div class="text-body-2 text-medium-emphasis">{dt.description}</div>
                      </v-card>
                    </v-col>
                  ))}
                </v-row>
              )}

              {createStep.value === 2 && (
                <div class="pt-2">
                  <v-row>
                    <v-col cols={12} sm={6}>
                      <v-text-field
                        v-model={createForm.number}
                        label="Номер документа *"
                        placeholder="напр. 001/2026"
                        prepend-inner-icon="mdi-pound"
                        hide-details="auto"
                      />
                    </v-col>
                    <v-col cols={12} sm={6}>
                      <v-text-field
                        v-model={createForm.date}
                        label="Дата *"
                        type="date"
                        prepend-inner-icon="mdi-calendar"
                        hide-details="auto"
                      />
                    </v-col>
                  </v-row>
                  <v-row>
                    <v-col cols={12}>
                      <v-autocomplete
                        v-model={createForm.objectId}
                        label="Будівельний обʼєкт *"
                        items={objects.value}
                        item-title="name"
                        item-value="id"
                        prepend-inner-icon="mdi-office-building-outline"
                        no-data-text="Немає обʼєктів"
                        hide-details="auto"
                      />
                    </v-col>
                    <v-col cols={12}>
                      <v-autocomplete
                        v-model={createForm.clientId}
                        label={isContract.value ? 'Клієнт (замовник) *' : 'Клієнт (замовник)'}
                        items={clients.value}
                        item-title="name"
                        item-value="id"
                        clearable={!isContract.value}
                        prepend-inner-icon="mdi-account-tie"
                        no-data-text="Немає клієнтів"
                        hint="Автоматично підтягується з обʼєкта"
                        persistent-hint
                      />
                    </v-col>
                    {isEstimateOrAct.value && (
                      <v-col cols={12} sm={6}>
                        <v-text-field
                          v-model={createForm.vatPercent}
                          label="ПДВ, %"
                          type="number"
                          min={0}
                          max={100}
                          clearable
                          prepend-inner-icon="mdi-bank-outline"
                          hint="Порожнє — авто з обʼєкта / налаштувань"
                          persistent-hint
                        />
                      </v-col>
                    )}
                  </v-row>
                  <v-alert type="info" variant="tonal" density="compact" class="mt-3" icon="mdi-information-outline">
                    Дані обʼєкта (матеріали, роботи, реквізити) буде збережено знімком. Після створення документ можна редагувати рядок за рядком.
                  </v-alert>
                </div>
              )}
            </v-card-text>
            {createStep.value === 2 && (
              <>
                <v-divider />
                <v-card-actions class="pa-4">
                  <v-spacer />
                  <v-btn variant="outlined" onClick={() => (createDialog.value = false)}>Скасувати</v-btn>
                  <v-btn color="primary" variant="elevated" loading={creating.value} onClick={submitCreate}>
                    Створити та редагувати
                  </v-btn>
                </v-card-actions>
              </>
            )}
          </v-card>
        </v-dialog>

        {/* Delete dialog */}
        <v-dialog v-model={deleteDialog.value} max-width={440}>
          <v-card>
            <v-card-title>Видалити документ?</v-card-title>
            <v-card-text>
              {deleteError.value
                ? <v-alert type="error" variant="tonal">{deleteError.value}</v-alert>
                : <span>«{typeMeta(deleteItem.value?.type)?.title} №{deleteItem.value?.number}» буде видалено без можливості відновлення.</span>
              }
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (deleteDialog.value = false)}>Скасувати</v-btn>
              {!deleteError.value && (
                <v-btn color="error" variant="elevated" loading={deleting.value} onClick={confirmDelete}>Видалити</v-btn>
              )}
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
