export default defineComponent({
  name: 'DocumentsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({ title: 'Шаблони документів' })

    const { data: objectsData } = useFetch('/api/objects')
    const { data: clientsData } = useFetch('/api/clients')

    const objects = computed(() => (objectsData.value as any)?.objects ?? [])
    const clients = computed(() => (clientsData.value as any)?.clients ?? [])

    const docTypes = [
      { title: 'Кошторис', value: 'estimate', icon: 'mdi-calculator-variant', color: 'primary', description: 'Кошторис на виконання робіт з переліком матеріалів та трудовитрат' },
      { title: 'Акт виконаних робіт', value: 'act', icon: 'mdi-clipboard-check-outline', color: 'success', description: 'Акт прийому-передачі виконаних робіт з деталізацією' },
      { title: 'Договір', value: 'contract', icon: 'mdi-file-sign', color: 'warning', description: 'Договір на виконання будівельно-монтажних робіт' },
    ]

    const form = reactive({
      type: '' as string,
      objectId: '',
      clientId: '',
      number: '',
      date: new Date().toISOString().split('T')[0],
      periodFrom: '',
      periodTo: '',
      totalAmount: null as number | null,
      prepaymentPercent: null as number | null,
      warrantyMonths: 12,
      notes: '',
    })

    const generating = ref(false)
    const error = ref('')
    const pdfPreviewUrl = ref('')
    const pdfPreviewDialog = ref(false)
    const pdfDownloadUrl = ref('')

    const selectedType = computed(() => docTypes.find((t) => t.value === form.type))
    const isContract = computed(() => form.type === 'contract')
    const isAct = computed(() => form.type === 'act')
    const isEstimateOrAct = computed(() => form.type === 'estimate' || form.type === 'act')

    const selectedObject = computed(() => objects.value.find((o: any) => o.id === form.objectId))
    const objectMarkup = computed(() => selectedObject.value?.markupPercent != null ? Number(selectedObject.value.markupPercent) : null)

    watch(() => form.objectId, (newId) => {
      if (!newId) return
      const obj = objects.value.find((o: any) => o.id === newId)
      if (obj?.clientId) {
        form.clientId = obj.clientId
      }
    })

    function selectType(type: string) {
      form.type = type
    }

    function resetForm() {
      form.type = ''
      form.objectId = ''
      form.clientId = ''
      form.number = ''
      form.date = new Date().toISOString().split('T')[0]
      form.periodFrom = ''
      form.periodTo = ''
      form.totalAmount = null
      form.prepaymentPercent = null
      form.warrantyMonths = 12
      form.notes = ''
      error.value = ''
      pdfPreviewUrl.value = ''
      pdfDownloadUrl.value = ''
    }

    function validate(): boolean {
      if (!form.type) { error.value = 'Оберіть тип документа'; return false }
      if (!form.objectId) { error.value = 'Оберіть об\'єкт'; return false }
      if (!form.number) { error.value = 'Вкажіть номер документа'; return false }
      if (!form.date) { error.value = 'Вкажіть дату'; return false }
      if (isContract.value && !form.clientId) { error.value = 'Для договору потрібен клієнт'; return false }
      return true
    }

    async function generatePdf(inline: boolean) {
      error.value = ''
      if (!validate()) return

      generating.value = true
      try {
        const body: Record<string, unknown> = {
          type: form.type,
          objectId: form.objectId,
          number: form.number,
          date: form.date,
          notes: form.notes || undefined,
        }
        if (form.clientId) body.clientId = form.clientId
        if (isAct.value) {
          if (form.periodFrom) body.periodFrom = form.periodFrom
          if (form.periodTo) body.periodTo = form.periodTo
        }
        if (isContract.value) {
          if (form.totalAmount != null) body.totalAmount = form.totalAmount
          if (form.prepaymentPercent != null) body.prepaymentPercent = form.prepaymentPercent
          body.warrantyMonths = form.warrantyMonths
        }

        const response = await $fetch.raw(`/api/documents/generate${inline ? '?inline=1' : ''}`, {
          method: 'POST',
          body,
          responseType: 'blob',
        })

        const blob = response._data as Blob
        const url = URL.createObjectURL(blob)

        if (inline) {
          if (pdfPreviewUrl.value) URL.revokeObjectURL(pdfPreviewUrl.value)
          pdfPreviewUrl.value = url
          pdfPreviewDialog.value = true
        } else {
          const a = document.createElement('a')
          a.href = url
          const disposition = response.headers.get('content-disposition') || ''
          const match = disposition.match(/filename\*=UTF-8''(.+)/)
          a.download = match ? decodeURIComponent(match[1]) : `document-${form.number}.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }
      } catch (e: any) {
        error.value = e?.data?.statusMessage || e?.message || 'Помилка генерації PDF'
      } finally {
        generating.value = false
      }
    }

    async function downloadFromPreview() {
      await generatePdf(false)
    }

    function closePreview() {
      pdfPreviewDialog.value = false
      if (pdfPreviewUrl.value) {
        URL.revokeObjectURL(pdfPreviewUrl.value)
        pdfPreviewUrl.value = ''
      }
    }

    return () => (
      <div>
        <div class="page-toolbar">
          <v-icon icon="mdi-file-document-edit-outline" size="28" class="mr-2" />
          <div class="text-h5 font-weight-bold">Шаблони документів</div>
        </div>

        {error.value && (
          <v-alert type="error" variant="tonal" class="mb-4" closable onUpdate:modelValue={() => (error.value = '')}>
            {error.value}
          </v-alert>
        )}

        {/* Step 1: Select document type */}
        {!form.type && (
          <>
            <div class="text-subtitle-1 text-medium-emphasis mb-4">Оберіть тип документа для генерації</div>
            <v-row>
              {docTypes.map((dt) => (
                <v-col key={dt.value} cols={12} sm={6} md={4}>
                  <v-card
                    class="pa-4 cursor-pointer doc-type-card"
                    variant="outlined"
                    hover
                    onClick={() => selectType(dt.value)}
                  >
                    <div class="d-flex align-center mb-3">
                      <v-avatar color={dt.color} variant="tonal" size={48} class="mr-3">
                        <v-icon icon={dt.icon} size={24} />
                      </v-avatar>
                      <div class="text-h6">{dt.title}</div>
                    </div>
                    <div class="text-body-2 text-medium-emphasis">{dt.description}</div>
                  </v-card>
                </v-col>
              ))}
            </v-row>
          </>
        )}

        {/* Step 2: Fill in form */}
        {form.type && (
          <div>
            <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-4" onClick={resetForm}>
              Назад до вибору
            </v-btn>

            <v-row>
              <v-col cols={12} md={8}>
                <v-card class="mb-4">
                  <v-card-title class="d-flex align-center">
                    <v-avatar color={selectedType.value?.color} variant="tonal" size={32} class="mr-2">
                      <v-icon icon={selectedType.value?.icon} size={18} />
                    </v-avatar>
                    {selectedType.value?.title}
                  </v-card-title>
                  <v-card-text>
                    <v-row>
                      <v-col cols={12} md={6}>
                        <v-text-field
                          v-model={form.number}
                          label="Номер документа *"
                          placeholder="напр. 001/2026"
                          prepend-inner-icon="mdi-pound"
                        />
                      </v-col>
                      <v-col cols={12} md={6}>
                        <v-text-field
                          v-model={form.date}
                          label="Дата *"
                          type="date"
                          prepend-inner-icon="mdi-calendar"
                        />
                      </v-col>
                    </v-row>

                    <v-row>
                      <v-col cols={12} md={6}>
                        <v-autocomplete
                          v-model={form.objectId}
                          label="Будівельний об'єкт *"
                          items={objects.value}
                          item-title="name"
                          item-value="id"
                          prepend-inner-icon="mdi-office-building-outline"
                          no-data-text="Немає об'єктів"
                        />
                        {isEstimateOrAct.value && form.objectId && (
                          <div class="mt-n2 mb-2">
                            {objectMarkup.value != null && objectMarkup.value > 0
                              ? (
                                <v-chip size="small" color="orange" variant="tonal" prepend-icon="mdi-percent">
                                  Націнка: {objectMarkup.value}%
                                </v-chip>
                              )
                              : (
                                <span class="text-caption text-medium-emphasis">Націнка не задана для цього об'єкта</span>
                              )
                            }
                          </div>
                        )}
                      </v-col>
                      <v-col cols={12} md={6}>
                        <v-autocomplete
                          v-model={form.clientId}
                          label={isContract.value ? 'Клієнт (замовник) *' : 'Клієнт (замовник)'}
                          items={clients.value}
                          item-title="name"
                          item-value="id"
                          clearable={!isContract.value}
                          prepend-inner-icon="mdi-account-tie"
                          no-data-text="Немає клієнтів"
                          hint="Автоматично підтягується з об'єкта"
                          persistent-hint
                        />
                      </v-col>
                    </v-row>

                    {/* Act-specific fields */}
                    {isAct.value && (
                      <v-row>
                        <v-col cols={12} md={6}>
                          <v-text-field
                            v-model={form.periodFrom}
                            label="Період з"
                            type="date"
                            prepend-inner-icon="mdi-calendar-start"
                          />
                        </v-col>
                        <v-col cols={12} md={6}>
                          <v-text-field
                            v-model={form.periodTo}
                            label="Період по"
                            type="date"
                            prepend-inner-icon="mdi-calendar-end"
                          />
                        </v-col>
                      </v-row>
                    )}

                    {/* Contract-specific fields */}
                    {isContract.value && (
                      <v-row>
                        <v-col cols={12} md={4}>
                          <v-text-field
                            v-model={form.totalAmount}
                            label="Сума договору, грн"
                            type="number"
                            min={0}
                            step={0.01}
                            prepend-inner-icon="mdi-currency-uah"
                            hint="Якщо не вказано — буде розрахована автоматично"
                            persistent-hint
                          />
                        </v-col>
                        <v-col cols={12} md={4}>
                          <v-text-field
                            v-model={form.prepaymentPercent}
                            label="Передоплата, %"
                            type="number"
                            min={0}
                            max={100}
                            prepend-inner-icon="mdi-percent"
                          />
                        </v-col>
                        <v-col cols={12} md={4}>
                          <v-text-field
                            v-model={form.warrantyMonths}
                            label="Гарантія, місяців"
                            type="number"
                            min={0}
                            prepend-inner-icon="mdi-shield-check-outline"
                          />
                        </v-col>
                      </v-row>
                    )}

                    <v-textarea
                      v-model={form.notes}
                      label="Примітки / додаткові умови"
                      rows={2}
                      auto-grow
                    />
                  </v-card-text>
                </v-card>
              </v-col>

              <v-col cols={12} md={4}>
                <v-card>
                  <v-card-title>Генерація PDF</v-card-title>
                  <v-card-text>
                    <div class="text-body-2 text-medium-emphasis mb-4">
                      Документ буде сформовано на основі даних обраного об'єкта:
                      переміщені матеріали, трудовитрати та реквізити клієнта.
                    </div>
                    {isEstimateOrAct.value && objectMarkup.value != null && objectMarkup.value > 0 && (
                      <v-alert type="info" variant="tonal" density="compact" class="mb-4" icon="mdi-percent">
                        До підсумку буде додано націнку <strong>{objectMarkup.value}%</strong>
                      </v-alert>
                    )}

                    <v-btn
                      block
                      color="primary"
                      variant="elevated"
                      size="large"
                      prepend-icon="mdi-file-pdf-box"
                      loading={generating.value}
                      class="mb-3"
                      onClick={() => generatePdf(true)}
                    >
                      Переглянути PDF
                    </v-btn>

                    <v-btn
                      block
                      variant="outlined"
                      size="large"
                      prepend-icon="mdi-download"
                      loading={generating.value}
                      onClick={() => generatePdf(false)}
                    >
                      Завантажити PDF
                    </v-btn>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </div>
        )}

        {/* PDF Preview Dialog */}
        <v-dialog v-model={pdfPreviewDialog.value} max-width={960} scrollable onUpdate:modelValue={(v: boolean) => { if (!v) closePreview() }}>
          <v-card>
            <v-card-title class="d-flex align-center flex-wrap gap-2">
              <span>Перегляд: {selectedType.value?.title}</span>
              <v-chip size="small" variant="tonal" color={selectedType.value?.color}>
                №{form.number}
              </v-chip>
              <v-spacer />
              <v-btn
                color="primary"
                variant="elevated"
                prepend-icon="mdi-download"
                loading={generating.value}
                onClick={downloadFromPreview}
              >
                Завантажити PDF
              </v-btn>
              <v-btn variant="text" icon="mdi-close" aria-label="Закрити" onClick={closePreview} />
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-0 pdf-preview-dialog__body">
              {pdfPreviewUrl.value ? (
                <iframe
                  title="Перегляд документа"
                  src={pdfPreviewUrl.value}
                  class="pdf-preview-dialog__iframe"
                />
              ) : null}
            </v-card-text>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
