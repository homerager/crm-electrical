interface MaterialForm {
  name: string
  sku: string
  unit: string
  quantity: string
  pricePerUnit: string
}
interface LaborForm {
  userName: string
  totalHours: string
  hourlyRate: string
}

const TYPE_META: Record<string, { title: string; icon: string; color: string }> = {
  estimate: { title: 'Кошторис', icon: 'mdi-calculator-variant', color: 'primary' },
  act: { title: 'Акт виконаних робіт', icon: 'mdi-clipboard-check-outline', color: 'success' },
  contract: { title: 'Договір', icon: 'mdi-file-sign', color: 'warning' },
}

const UNIT_OPTIONS = ['шт', 'м', 'м²', 'м³', 'кг', 'т', 'л', 'уп', 'к-т', 'пог.м', 'компл.', 'послуга']

export default defineComponent({
  name: 'DocumentEditPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const docId = computed(() => route.params.id as string)

    const toast = useToast()
    const loaded = ref<any>(null)
    const loadError = ref('')
    const docType = ref<'estimate' | 'act' | 'contract'>('estimate')

    useHead({ title: computed(() => (loaded.value ? `${TYPE_META[docType.value]?.title} №${loaded.value.number}` : 'Документ')) })

    /* ── Product catalog (for the material name picker) ── */
    const { data: productsData } = useFetch('/api/products')
    const products = computed(() => (productsData.value as any)?.products ?? [])

    /* ── Form state ── */
    const number = ref('')
    const date = ref('')
    const notes = ref('')
    const vatPercent = ref('0')

    const objectInfo = reactive({ name: '', address: '' })
    const clientInfo = reactive({
      name: '', contactPerson: '', phone: '', email: '',
      address: '', taxCode: '', iban: '', bankName: '', bankMfo: '',
    })

    const materials = ref<MaterialForm[]>([])
    const labor = ref<LaborForm[]>([])
    const periodFrom = ref('')
    const periodTo = ref('')
    const totalAmount = ref('0')
    const prepaymentPercent = ref('')
    const warrantyMonths = ref('12')

    const isContract = computed(() => docType.value === 'contract')
    const isAct = computed(() => docType.value === 'act')
    const isEstimateOrAct = computed(() => docType.value === 'estimate' || docType.value === 'act')

    async function loadDoc() {
      loadError.value = ''
      try {
        const res = await $fetch(`/api/documents/${docId.value}`) as any
        const d = res.document
        loaded.value = d
        docType.value = d.type
        number.value = d.number
        date.value = d.date ? new Date(d.date).toISOString().split('T')[0] : ''
        notes.value = d.notes || ''

        const data = d.data || {}
        vatPercent.value = String(data.vatPercent ?? 0)
        objectInfo.name = data.object?.name || ''
        objectInfo.address = data.object?.address || ''

        const c = data.client || {}
        clientInfo.name = c.name || ''
        clientInfo.contactPerson = c.contactPerson || ''
        clientInfo.phone = c.phone || ''
        clientInfo.email = c.email || ''
        clientInfo.address = c.address || ''
        clientInfo.taxCode = c.taxCode || ''
        clientInfo.iban = c.iban || ''
        clientInfo.bankName = c.bankName || ''
        clientInfo.bankMfo = c.bankMfo || ''

        materials.value = (data.materials || []).map((m: any) => ({
          name: m.name || '',
          sku: m.sku || '',
          unit: m.unit || 'шт',
          quantity: String(Number(m.quantity ?? 0)),
          pricePerUnit: String(Number(m.pricePerUnit ?? 0)),
        }))
        labor.value = (data.labor || []).map((l: any) => ({
          userName: l.userName || '',
          totalHours: String(Number(l.totalHours ?? 0)),
          hourlyRate: l.hourlyRate != null ? String(Number(l.hourlyRate)) : '',
        }))

        periodFrom.value = data.periodFrom ? String(data.periodFrom).split('T')[0] : ''
        periodTo.value = data.periodTo ? String(data.periodTo).split('T')[0] : ''
        totalAmount.value = String(Number(data.totalAmount ?? 0))
        prepaymentPercent.value = data.prepaymentPercent != null ? String(Number(data.prepaymentPercent)) : ''
        warrantyMonths.value = data.warrantyMonths != null ? String(Number(data.warrantyMonths)) : '12'
      } catch (e: any) {
        loadError.value = e?.data?.statusMessage || 'Помилка завантаження документа'
      }
    }

    onMounted(loadDoc)

    /* ── Row helpers ── */
    function addMaterial() {
      materials.value.push({ name: '', sku: '', unit: 'шт', quantity: '1', pricePerUnit: '0' })
    }
    function removeMaterial(idx: number) {
      materials.value.splice(idx, 1)
    }
    /** Combobox update: a picked product is an object → autofill sku/unit; free text is a string. */
    function applyMaterialName(m: MaterialForm, val: any) {
      if (val && typeof val === 'object') {
        m.name = String(val.name ?? '')
        m.sku = String(val.sku ?? '')
        m.unit = String(val.unit ?? m.unit ?? 'шт')
      } else {
        m.name = val == null ? '' : String(val)
      }
    }
    function addLabor() {
      labor.value.push({ userName: '', totalHours: '0', hourlyRate: '' })
    }
    function removeLabor(idx: number) {
      labor.value.splice(idx, 1)
    }

    const n = (v: string) => {
      const x = parseFloat(String(v).replace(',', '.'))
      return Number.isFinite(x) ? x : 0
    }

    const matLineTotal = (m: MaterialForm) => n(m.quantity) * n(m.pricePerUnit)
    const labLineTotal = (l: LaborForm) => n(l.totalHours) * n(l.hourlyRate)

    const baseTotal = computed(() => {
      if (isContract.value) {
        const t = n(totalAmount.value)
        const v = n(vatPercent.value)
        return v > 0 ? t / (1 + v / 100) : t
      }
      const mat = materials.value.reduce((s, m) => s + matLineTotal(m), 0)
      const lab = labor.value.reduce((s, l) => s + labLineTotal(l), 0)
      return mat + lab
    })
    const vatAmount = computed(() => {
      if (isContract.value) return n(totalAmount.value) - baseTotal.value
      return baseTotal.value * n(vatPercent.value) / 100
    })
    const grandTotal = computed(() => {
      if (isContract.value) return n(totalAmount.value)
      return baseTotal.value + vatAmount.value
    })

    function fmtMoney(v: number) {
      return v.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const isValid = computed(() => {
      if (!number.value.trim()) return false
      if (!objectInfo.name.trim()) return false
      if (isContract.value && !clientInfo.name.trim()) return false
      return true
    })

    /* ── Build payload ── */
    function buildData() {
      const data: any = {
        object: { name: objectInfo.name.trim(), address: objectInfo.address.trim() || null },
        vatPercent: n(vatPercent.value),
      }
      data.client = clientInfo.name.trim()
        ? {
            name: clientInfo.name.trim(),
            contactPerson: clientInfo.contactPerson.trim() || null,
            phone: clientInfo.phone.trim() || null,
            email: clientInfo.email.trim() || null,
            address: clientInfo.address.trim() || null,
            taxCode: clientInfo.taxCode.trim() || null,
            iban: clientInfo.iban.trim() || null,
            bankName: clientInfo.bankName.trim() || null,
            bankMfo: clientInfo.bankMfo.trim() || null,
          }
        : null

      if (isEstimateOrAct.value) {
        data.materials = materials.value.map((m) => ({
          name: m.name.trim(),
          sku: m.sku.trim() || null,
          unit: m.unit || 'шт',
          quantity: n(m.quantity),
          pricePerUnit: n(m.pricePerUnit),
        }))
        data.labor = labor.value.map((l) => ({
          userName: l.userName.trim(),
          totalHours: n(l.totalHours),
          hourlyRate: l.hourlyRate.trim() === '' ? null : n(l.hourlyRate),
        }))
        if (isAct.value) {
          data.periodFrom = periodFrom.value || null
          data.periodTo = periodTo.value || null
        }
      }
      if (isContract.value) {
        data.totalAmount = n(totalAmount.value)
        data.prepaymentPercent = prepaymentPercent.value.trim() === '' ? null : n(prepaymentPercent.value)
        data.warrantyMonths = warrantyMonths.value.trim() === '' ? null : n(warrantyMonths.value)
      }
      return data
    }

    /* ── Save / PDF ── */
    const saving = ref(false)
    const saveError = ref('')
    const savedAt = ref<string>('')

    async function persist(): Promise<boolean> {
      saveError.value = ''
      try {
        await $fetch(`/api/documents/${docId.value}`, {
          method: 'PUT',
          body: { number: number.value.trim(), date: date.value, notes: notes.value, data: buildData() },
        })
        return true
      } catch (e: any) {
        saveError.value = e?.data?.statusMessage || 'Помилка збереження'
        toast.error(saveError.value)
        return false
      }
    }

    async function save() {
      if (!isValid.value) return
      saving.value = true
      const ok = await persist()
      saving.value = false
      if (ok) {
        savedAt.value = new Date().toLocaleString('uk-UA')
        await loadDoc()
        toast.success('Документ збережено')
      }
    }

    const downloading = ref(false)
    async function downloadPdf() {
      if (!isValid.value) return
      downloading.value = true
      try {
        if (!await persist()) return
        const blob = await $fetch(`/api/documents/${docId.value}/pdf`, { responseType: 'blob' }) as Blob
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${TYPE_META[docType.value]?.title || 'Документ'}-${number.value}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        savedAt.value = new Date().toLocaleString('uk-UA')
      } catch (e: any) {
        saveError.value = e?.data?.statusMessage || 'Помилка генерації PDF'
      } finally {
        downloading.value = false
      }
    }

    const previewDialog = ref(false)
    const previewUrl = ref('')
    const previewing = ref(false)
    async function openPreview() {
      if (!isValid.value) return
      previewing.value = true
      try {
        if (!await persist()) return
        const blob = await $fetch(`/api/documents/${docId.value}/pdf?inline=1`, { responseType: 'blob' }) as Blob
        if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
        previewUrl.value = URL.createObjectURL(blob)
        previewDialog.value = true
        savedAt.value = new Date().toLocaleString('uk-UA')
      } catch (e: any) {
        saveError.value = e?.data?.statusMessage || 'Помилка генерації PDF'
      } finally {
        previewing.value = false
      }
    }
    function closePreview() {
      previewDialog.value = false
      setTimeout(() => {
        if (previewUrl.value) { URL.revokeObjectURL(previewUrl.value); previewUrl.value = '' }
      }, 500)
    }

    /* ── Render ── */
    const meta = computed(() => TYPE_META[docType.value])

    const renderActions = (dense = false) => (
      <div class={`d-flex gap-2 ${dense ? '' : 'flex-wrap'}`}>
        <v-btn
          color="secondary"
          variant="outlined"
          prepend-icon="mdi-eye-outline"
          loading={previewing.value}
          disabled={!isValid.value}
          onClick={openPreview}
        >
          Переглянути PDF
        </v-btn>
        <v-btn
          color="error"
          variant="outlined"
          prepend-icon="mdi-file-pdf-box"
          loading={downloading.value}
          disabled={!isValid.value}
          onClick={downloadPdf}
        >
          Завантажити PDF
        </v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          prepend-icon="mdi-content-save"
          loading={saving.value}
          disabled={!isValid.value}
          onClick={save}
        >
          Зберегти
        </v-btn>
      </div>
    )

    return () => (
      <div>
        <div class="page-toolbar">
          <v-btn variant="text" icon="mdi-arrow-left" to="/documents" class="mr-2" />
          {meta.value && (
            <v-avatar color={meta.value.color} variant="tonal" size={36} class="mr-3">
              <v-icon icon={meta.value.icon} size={20} />
            </v-avatar>
          )}
          <div>
            <div class="text-h6 font-weight-bold">{meta.value?.title}</div>
            {loaded.value && <div class="text-caption text-medium-emphasis">№{loaded.value.number}</div>}
          </div>
          <v-spacer />
          {loaded.value && renderActions(true)}
        </div>

        {loadError.value && <v-alert type="error" variant="tonal" class="mb-4">{loadError.value}</v-alert>}
        {saveError.value && (
          <v-alert type="error" variant="tonal" closable class="mb-4" onUpdate:modelValue={() => (saveError.value = '')}>
            {saveError.value}
          </v-alert>
        )}

        {loaded.value && (
          <v-row>
            <v-col cols={12} md={8}>
              {/* Header fields */}
              <v-card class="mb-4">
                <v-card-title class="text-subtitle-1">Реквізити документа</v-card-title>
                <v-card-text>
                  <v-row>
                    <v-col cols={12} sm={6}>
                      <v-text-field
                        v-model={number.value}
                        label="Номер документа *"
                        prepend-inner-icon="mdi-pound"
                        hide-details="auto"
                      />
                    </v-col>
                    <v-col cols={12} sm={6}>
                      <v-text-field
                        v-model={date.value}
                        label="Дата *"
                        type="date"
                        prepend-inner-icon="mdi-calendar"
                        hide-details="auto"
                      />
                    </v-col>
                    {isAct.value && (
                      <>
                        <v-col cols={12} sm={6}>
                          <v-text-field
                            v-model={periodFrom.value}
                            label="Період з"
                            type="date"
                            prepend-inner-icon="mdi-calendar-start"
                            clearable
                            hide-details="auto"
                          />
                        </v-col>
                        <v-col cols={12} sm={6}>
                          <v-text-field
                            v-model={periodTo.value}
                            label="Період по"
                            type="date"
                            prepend-inner-icon="mdi-calendar-end"
                            clearable
                            hide-details="auto"
                          />
                        </v-col>
                      </>
                    )}
                    <v-col cols={12} sm={6}>
                      <v-text-field
                        v-model={vatPercent.value}
                        label="ПДВ, %"
                        type="number"
                        min={0}
                        max={100}
                        prepend-inner-icon="mdi-bank-outline"
                        hint="0 — без ПДВ"
                        persistent-hint
                      />
                    </v-col>
                  </v-row>
                  <v-textarea
                    v-model={notes.value}
                    label={isContract.value ? 'Додаткові умови' : 'Примітки'}
                    rows={2}
                    auto-grow
                    class="mt-2"
                  />
                </v-card-text>
              </v-card>

              {/* Contract terms */}
              {isContract.value && (
                <v-card class="mb-4">
                  <v-card-title class="text-subtitle-1">Умови договору</v-card-title>
                  <v-card-text>
                    <v-row>
                      <v-col cols={12} sm={4}>
                        <v-text-field
                          v-model={totalAmount.value}
                          label="Сума договору (з ПДВ), грн"
                          type="number"
                          min={0}
                          step={0.01}
                          prepend-inner-icon="mdi-currency-uah"
                          hide-details="auto"
                        />
                      </v-col>
                      <v-col cols={12} sm={4}>
                        <v-text-field
                          v-model={prepaymentPercent.value}
                          label="Передоплата, %"
                          type="number"
                          min={0}
                          max={100}
                          clearable
                          prepend-inner-icon="mdi-percent"
                          hide-details="auto"
                        />
                      </v-col>
                      <v-col cols={12} sm={4}>
                        <v-text-field
                          v-model={warrantyMonths.value}
                          label="Гарантія, місяців"
                          type="number"
                          min={0}
                          prepend-inner-icon="mdi-shield-check-outline"
                          hide-details="auto"
                        />
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              )}

              {/* Materials */}
              {isEstimateOrAct.value && (
                <v-card class="mb-4">
                  <v-card-title class="d-flex align-center text-subtitle-1">
                    <span>Матеріали</span>
                    <v-chip size="x-small" color="primary" variant="tonal" class="ml-2">{materials.value.length}</v-chip>
                    <v-spacer />
                    <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" onClick={addMaterial}>Додати рядок</v-btn>
                  </v-card-title>
                  <v-card-text>
                    {materials.value.length === 0 ? (
                      <v-alert type="info" variant="tonal" density="compact">Немає матеріалів. Додайте рядок вручну.</v-alert>
                    ) : (
                      materials.value.map((m, idx) => (
                        <v-card key={idx} variant="outlined" class="mb-2 pa-2">
                          <v-row dense align="center">
                            <v-col cols={12} md={4}>
                              <v-combobox
                                modelValue={m.name}
                                onUpdate:modelValue={(v: any) => applyMaterialName(m, v)}
                                items={products.value}
                                item-title="name"
                                label="Найменування *"
                                placeholder="Оберіть товар або введіть назву"
                                density="compact"
                                hide-details
                                variant="underlined"
                                no-data-text="Немає товарів у каталозі"
                                returnObject
                              />
                            </v-col>
                            <v-col cols={6} md={2}>
                              <v-text-field v-model={m.sku} label="Артикул" density="compact" hide-details variant="underlined" />
                            </v-col>
                            <v-col cols={6} md={1}>
                              <v-combobox v-model={m.unit} label="Од." items={UNIT_OPTIONS} density="compact" hide-details variant="underlined" />
                            </v-col>
                            <v-col cols={4} md={2}>
                              <v-text-field v-model={m.quantity} label="К-сть" type="number" density="compact" hide-details variant="underlined" />
                            </v-col>
                            <v-col cols={4} md={2}>
                              <v-text-field v-model={m.pricePerUnit} label="Ціна, грн" type="number" density="compact" hide-details variant="underlined" />
                            </v-col>
                            <v-col cols={4} md={1} class="d-flex justify-end">
                              <v-btn icon="mdi-delete-outline" variant="text" size="small" color="error" onClick={() => removeMaterial(idx)} />
                            </v-col>
                          </v-row>
                          <div class="text-caption text-medium-emphasis text-right pr-2">
                            Сума рядка: <strong>{fmtMoney(matLineTotal(m))} грн</strong>
                          </div>
                        </v-card>
                      ))
                    )}
                  </v-card-text>
                </v-card>
              )}

              {/* Labor */}
              {isEstimateOrAct.value && (
                <v-card class="mb-4">
                  <v-card-title class="d-flex align-center text-subtitle-1">
                    <span>Роботи</span>
                    <v-chip size="x-small" color="primary" variant="tonal" class="ml-2">{labor.value.length}</v-chip>
                    <v-spacer />
                    <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" onClick={addLabor}>Додати рядок</v-btn>
                  </v-card-title>
                  <v-card-text>
                    {labor.value.length === 0 ? (
                      <v-alert type="info" variant="tonal" density="compact">Немає робіт. Додайте рядок вручну.</v-alert>
                    ) : (
                      labor.value.map((l, idx) => (
                        <v-card key={idx} variant="outlined" class="mb-2 pa-2">
                          <v-row dense align="center">
                            <v-col cols={12} md={5}>
                              <v-text-field v-model={l.userName} label="Працівник / вид робіт *" density="compact" hide-details variant="underlined" />
                            </v-col>
                            <v-col cols={5} md={3}>
                              <v-text-field v-model={l.totalHours} label="Годин" type="number" density="compact" hide-details variant="underlined" />
                            </v-col>
                            <v-col cols={5} md={3}>
                              <v-text-field v-model={l.hourlyRate} label="Ставка, грн/год" type="number" density="compact" hide-details variant="underlined" />
                            </v-col>
                            <v-col cols={2} md={1} class="d-flex justify-end">
                              <v-btn icon="mdi-delete-outline" variant="text" size="small" color="error" onClick={() => removeLabor(idx)} />
                            </v-col>
                          </v-row>
                          <div class="text-caption text-medium-emphasis text-right pr-2">
                            Сума рядка: <strong>{l.hourlyRate.trim() === '' ? '—' : `${fmtMoney(labLineTotal(l))} грн`}</strong>
                          </div>
                        </v-card>
                      ))
                    )}
                  </v-card-text>
                </v-card>
              )}

              {/* Object & client */}
              <v-card class="mb-4">
                <v-card-title class="text-subtitle-1">Обʼєкт та замовник</v-card-title>
                <v-card-text>
                  <div class="text-overline text-medium-emphasis">Будівельний обʼєкт</div>
                  <v-row>
                    <v-col cols={12} sm={6}>
                      <v-text-field v-model={objectInfo.name} label="Назва обʼєкта *" density="compact" hide-details="auto" />
                    </v-col>
                    <v-col cols={12} sm={6}>
                      <v-text-field v-model={objectInfo.address} label="Адреса обʼєкта" density="compact" hide-details="auto" />
                    </v-col>
                  </v-row>

                  <div class="text-overline text-medium-emphasis mt-4">
                    Замовник {isContract.value && <span class="text-error">*</span>}
                  </div>
                  <v-row>
                    <v-col cols={12} sm={6}>
                      <v-text-field v-model={clientInfo.name} label={`Назва${isContract.value ? ' *' : ''}`} density="compact" hide-details="auto" />
                    </v-col>
                    <v-col cols={12} sm={6}>
                      <v-text-field v-model={clientInfo.contactPerson} label="Контактна особа" density="compact" hide-details="auto" />
                    </v-col>
                    <v-col cols={12} sm={6}>
                      <v-text-field v-model={clientInfo.phone} label="Телефон" density="compact" hide-details="auto" />
                    </v-col>
                    <v-col cols={12} sm={6}>
                      <v-text-field v-model={clientInfo.email} label="Email" density="compact" hide-details="auto" />
                    </v-col>
                    <v-col cols={12} sm={6}>
                      <v-text-field v-model={clientInfo.address} label="Адреса" density="compact" hide-details="auto" />
                    </v-col>
                    <v-col cols={12} sm={6}>
                      <v-text-field v-model={clientInfo.taxCode} label="ЄДРПОУ / ІПН" density="compact" hide-details="auto" />
                    </v-col>
                    <v-col cols={12} sm={6}>
                      <v-text-field v-model={clientInfo.iban} label="IBAN" density="compact" hide-details="auto" />
                    </v-col>
                    <v-col cols={12} sm={3}>
                      <v-text-field v-model={clientInfo.bankName} label="Банк" density="compact" hide-details="auto" />
                    </v-col>
                    <v-col cols={12} sm={3}>
                      <v-text-field v-model={clientInfo.bankMfo} label="МФО" density="compact" hide-details="auto" />
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>

            {/* Summary sidebar */}
            <v-col cols={12} md={4}>
              <v-card class="mb-4" style="position:sticky;top:16px;">
                <v-card-title class="text-subtitle-1">Підсумок</v-card-title>
                <v-card-text>
                  <v-table density="compact">
                    <tbody>
                      <tr>
                        <td class="text-medium-emphasis">{isContract.value ? 'Сума без ПДВ' : 'Всього без ПДВ'}</td>
                        <td class="text-right">{fmtMoney(baseTotal.value)} грн</td>
                      </tr>
                      <tr>
                        <td class="text-medium-emphasis">ПДВ ({n(vatPercent.value)}%)</td>
                        <td class="text-right">{fmtMoney(vatAmount.value)} грн</td>
                      </tr>
                      <tr>
                        <td class="font-weight-bold">Разом</td>
                        <td class="text-right font-weight-bold text-primary text-body-1">{fmtMoney(grandTotal.value)} грн</td>
                      </tr>
                    </tbody>
                  </v-table>

                  <v-divider class="my-3" />
                  {renderActions()}

                  <div class="text-caption text-medium-emphasis mt-3">
                    {savedAt.value
                      ? `Збережено: ${savedAt.value}`
                      : `Оновлено: ${new Date(loaded.value.updatedAt).toLocaleString('uk-UA')}`}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    PDF генерується зі збережених даних. Натисніть «Зберегти» перед генерацією.
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        )}

        {/* PDF preview dialog */}
        <v-dialog v-model={previewDialog.value} fullscreen transition="dialog-bottom-transition">
          <v-card style="display:flex;flex-direction:column;height:100%;">
            <v-toolbar color="primary" density="compact">
              <v-toolbar-title class="text-body-1 font-weight-medium">
                Перегляд: {meta.value?.title} №{number.value}
              </v-toolbar-title>
              <v-spacer />
              <v-btn variant="text" prepend-icon="mdi-file-pdf-box" loading={downloading.value} onClick={downloadPdf}>
                Завантажити
              </v-btn>
              <v-btn icon="mdi-close" onClick={closePreview} />
            </v-toolbar>
            <div style="flex:1;overflow:hidden;">
              {previewUrl.value && (
                <iframe src={previewUrl.value} style="width:100%;height:100%;border:none;" title="PDF" />
              )}
            </div>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
