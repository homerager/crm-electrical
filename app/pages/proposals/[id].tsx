interface FormItem {
  proposalProductId?: string
  name: string
  qty: string
  unit: string
  priceExVat: string
  vatPercent: string
  highlight: string
  spec: string
}

export default defineComponent({
  name: 'ProposalEditPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const isNew = computed(() => route.params.id === 'new')

    useHead({ title: computed(() => (isNew.value ? 'Нова КП' : 'Редагування КП')) })

    /* ── Remote data ── */
    const { data: requisitesData } = useFetch('/api/requisites')
    const requisites = computed(() => (requisitesData.value as any)?.requisites ?? [])

    const { data: ppData } = useFetch('/api/proposal-products', { query: { active: 'false' } })
    const proposalProducts = computed(() => (ppData.value as any)?.items ?? [])

    /* ── Load existing proposal (edit mode) ── */
    const loadedProposal = ref<any>(null)
    const loadError = ref('')
    const today = new Date().toISOString().split('T')[0]

    /* ── Form state ── */
    const meta = reactive({
      title: '',
      subtitle: '',
      tagline: '',
      date: today,
      usdRate: '',
      requisiteId: '',
    })

    const items = ref<FormItem[]>([])
    const worksDescription = ref('')
    const techSpecs = ref('')
    const activeTab = ref('main')

    async function loadProposal() {
      if (isNew.value) return
      try {
        const res = await $fetch(`/api/proposals/${route.params.id}`) as any
        const p = res.proposal
        loadedProposal.value = p
        meta.title = p.title
        meta.subtitle = p.subtitle || ''
        meta.tagline = p.tagline || ''
        meta.date = p.date ? new Date(p.date).toISOString().split('T')[0] : today
        meta.usdRate = p.usdRate ? String(Number(p.usdRate)) : ''
        meta.requisiteId = p.requisiteId || ''
        worksDescription.value = p.worksDescription || ''
        techSpecs.value = p.techSpecs || ''
        items.value = (p.items || []).map((i: any) => ({
          proposalProductId: i.proposalProductId || undefined,
          name: i.name,
          qty: String(Number(i.quantity)),
          unit: i.unit,
          priceExVat: String(Number(i.priceExVat)),
          vatPercent: String(Number(i.vatPercent)),
          highlight: i.highlight || '',
          spec: i.spec || '',
        }))
      } catch (e: any) {
        loadError.value = e?.data?.statusMessage || 'Помилка завантаження'
      }
    }

    onMounted(loadProposal)

    /* ── Product picker ── */
    const productPickerDialog = ref(false)
    const pickerSearch = ref('')
    const pickerGroupFilter = ref<string | null>(null)
    const pickerSelected = ref<Set<string>>(new Set())

    const pickerGroups = computed(() => {
      const set = new Set<string>()
      for (const p of proposalProducts.value) if (p.groupName) set.add(p.groupName)
      return Array.from(set).sort()
    })

    const pickerGroupOptions = computed(() => [
      { title: 'Усі групи', value: null },
      ...pickerGroups.value.map((g) => ({ title: g, value: g })),
    ])

    const pickerItems = computed(() => {
      let list = proposalProducts.value.filter((p: any) => p.isActive)
      if (pickerSearch.value) {
        const q = pickerSearch.value.toLowerCase()
        list = list.filter(
          (p: any) =>
            p.name.toLowerCase().includes(q) ||
            (p.sku || '').toLowerCase().includes(q) ||
            (p.groupName || '').toLowerCase().includes(q),
        )
      }
      if (pickerGroupFilter.value) {
        list = list.filter((p: any) => p.groupName === pickerGroupFilter.value)
      }
      return list
    })

    function openPicker() {
      pickerSearch.value = ''
      pickerGroupFilter.value = null
      pickerSelected.value = new Set(
        items.value.filter((i) => i.proposalProductId).map((i) => i.proposalProductId!),
      )
      productPickerDialog.value = true
    }

    function togglePicker(id: string) {
      const s = new Set(pickerSelected.value)
      s.has(id) ? s.delete(id) : s.add(id)
      pickerSelected.value = s
    }

    function applyPicker() {
      const existing = new Set(
        items.value.filter((i) => i.proposalProductId).map((i) => i.proposalProductId!),
      )
      for (const id of pickerSelected.value) {
        if (existing.has(id)) continue
        const p = proposalProducts.value.find((pr: any) => pr.id === id)
        if (!p) continue
        items.value.push({
          proposalProductId: p.id,
          name: p.name,
          qty: '1',
          unit: p.unit,
          priceExVat: String(Number(p.priceExVat)),
          vatPercent: String(Number(p.vatPercent)),
          highlight: '',
          spec: '',
        })
      }
      // Remove items deselected in picker
      items.value = items.value.filter(
        (i) => !i.proposalProductId || pickerSelected.value.has(i.proposalProductId),
      )
      productPickerDialog.value = false
    }

    function addManual() {
      items.value.push({
        name: '',
        qty: '1',
        unit: 'шт',
        priceExVat: '0',
        vatPercent: '0',
        highlight: '',
        spec: '',
      })
    }

    function removeItem(idx: number) {
      items.value.splice(idx, 1)
    }

    function moveItem(idx: number, dir: -1 | 1) {
      const to = idx + dir
      if (to < 0 || to >= items.value.length) return
      ;[items.value[idx], items.value[to]] = [items.value[to], items.value[idx]]
    }

    const lineExVat = (item: FormItem) =>
      (parseFloat(item.qty) || 0) * (parseFloat(item.priceExVat) || 0)

    const lineTotal = (item: FormItem) =>
      lineExVat(item) * (1 + (parseFloat(item.vatPercent) || 0) / 100)

    const grandTotalExVat = computed(() => items.value.reduce((s, i) => s + lineExVat(i), 0))
    const grandTotal = computed(() => items.value.reduce((s, i) => s + lineTotal(i), 0))
    const equipmentCardsCount = computed(() => items.value.filter((i) => i.highlight.trim()).length)

    function fmtMoney(n: number) {
      return n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const isValid = computed(
      () => meta.title.trim() && items.value.length > 0 && items.value.every((i) => i.name.trim()),
    )

    /* ── Save ── */
    const saving = ref(false)
    const saveError = ref('')

    function buildBody() {
      return {
        title: meta.title.trim(),
        subtitle: meta.subtitle.trim() || undefined,
        tagline: meta.tagline.trim() || undefined,
        date: meta.date,
        usdRate: meta.usdRate ? parseFloat(meta.usdRate) : undefined,
        requisiteId: meta.requisiteId || undefined,
        worksDescription: worksDescription.value.trim() || undefined,
        techSpecs: techSpecs.value.trim() || undefined,
        items: items.value.map((i, idx) => ({
          proposalProductId: i.proposalProductId || undefined,
          name: i.name,
          quantity: parseFloat(i.qty) || 0,
          unit: i.unit,
          priceExVat: parseFloat(i.priceExVat) || 0,
          vatPercent: parseFloat(i.vatPercent) || 0,
          highlight: i.highlight.trim() || undefined,
          spec: i.spec.trim() || undefined,
          sortOrder: idx,
        })),
      }
    }

    async function save() {
      if (!isValid.value) return
      saving.value = true
      saveError.value = ''
      try {
        if (isNew.value) {
          const res = await $fetch('/api/proposals', { method: 'POST', body: buildBody() }) as any
          await navigateTo(`/proposals/${res.proposal.id}`)
        } else {
          await $fetch(`/api/proposals/${route.params.id}`, { method: 'PUT', body: buildBody() })
        }
      } catch (e: any) {
        saveError.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        saving.value = false
      }
    }

    /* ── Download PDF ── */
    const downloading = ref(false)

    async function downloadPdf() {
      if (isNew.value) { await save(); return }
      downloading.value = true
      try {
        const blob = await $fetch(`/api/proposals/${route.params.id}/pdf`, { responseType: 'blob' }) as Blob
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `КП_${meta.title.slice(0, 40)}.pdf`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 30_000)
      } catch (e: any) {
        saveError.value = e?.data?.statusMessage || 'Помилка генерації PDF'
      } finally {
        downloading.value = false
      }
    }

    const unitOptions = ['шт', 'м', 'м²', 'м³', 'кг', 'т', 'л', 'уп', 'к-т', 'пог.м', 'компл.', 'послуга']
    const vatOptions = [
      { title: 'Без ПДВ (0%)', value: '0' },
      { title: 'ПДВ 7%', value: '7' },
      { title: 'ПДВ 20%', value: '20' },
    ]

    const requisiteOptions = computed(() => [
      { title: '— без реквізитів —', value: '' },
      ...requisites.value.map((r: any) => ({ title: r.name, value: r.id })),
    ])

    return () => (
      <div>
        {/* Toolbar */}
        <div class="page-toolbar">
          <v-btn variant="text" icon="mdi-arrow-left" to="/proposals" class="mr-2" />
          <div class="text-h5 font-weight-bold">
            {isNew.value ? 'Нова комерційна пропозиція' : (meta.title || 'Редагування КП')}
          </div>
          <v-spacer />
          {!isNew.value && (
            <v-btn
              color="error"
              variant="outlined"
              prepend-icon="mdi-file-pdf-box"
              loading={downloading.value}
              disabled={!isValid.value}
              class="mr-2"
              onClick={downloadPdf}
            >
              PDF
            </v-btn>
          )}
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

        {loadError.value && <v-alert type="error" variant="tonal" class="mb-4">{loadError.value}</v-alert>}
        {saveError.value && (
          <v-alert type="error" variant="tonal" closable class="mb-4"
            onUpdate:modelValue={() => (saveError.value = '')}>
            {saveError.value}
          </v-alert>
        )}

        <v-tabs v-model={activeTab.value} color="primary" class="mb-1">
          <v-tab value="main">Параметри</v-tab>
          <v-tab value="items">
            Позиції
            {items.value.length > 0 && (
              <v-chip size="x-small" color="primary" variant="tonal" class="ml-2">
                {items.value.length}
              </v-chip>
            )}
          </v-tab>
          <v-tab value="extras">Додатково</v-tab>
        </v-tabs>

        <v-window v-model={activeTab.value}>

          {/* ── Tab: Parameters ── */}
          <v-window-item value="main">
            <v-card class="mt-2">
              <v-card-text>
                <v-row>
                  <v-col cols={12}>
                    <v-text-field
                      v-model={meta.title}
                      label="Назва проекту *"
                      placeholder="Гібридна сонячна електростанція"
                      prepend-inner-icon="mdi-text"
                      variant="outlined"
                      hide-details="auto"
                    />
                  </v-col>
                  <v-col cols={12} sm={6}>
                    <v-text-field
                      v-model={meta.subtitle}
                      label="Підзаголовок"
                      placeholder="Deye 30 кВт / 71,68 кВт·год"
                      variant="outlined"
                      hide-details="auto"
                    />
                  </v-col>
                  <v-col cols={12} sm={6}>
                    <v-text-field
                      v-model={meta.tagline}
                      label="Рядок опису"
                      placeholder="Дахова система · 3-фазна мережа"
                      variant="outlined"
                      hide-details="auto"
                    />
                  </v-col>
                  <v-col cols={6} sm={3}>
                    <v-text-field
                      v-model={meta.date}
                      label="Дата КП"
                      type="date"
                      prepend-inner-icon="mdi-calendar"
                      variant="outlined"
                      hide-details="auto"
                    />
                  </v-col>
                  <v-col cols={6} sm={3}>
                    <v-text-field
                      v-model={meta.usdRate}
                      label="Курс $ (грн)"
                      type="number"
                      placeholder="43.9"
                      prepend-inner-icon="mdi-currency-usd"
                      variant="outlined"
                      hide-details="auto"
                    />
                  </v-col>
                  <v-col cols={12} sm={6}>
                    <v-select
                      v-model={meta.requisiteId}
                      label="Реквізити компанії"
                      items={requisiteOptions.value}
                      item-title="title"
                      item-value="value"
                      prepend-inner-icon="mdi-domain"
                      variant="outlined"
                      hide-details="auto"
                    />
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-window-item>

          {/* ── Tab: Items ── */}
          <v-window-item value="items">
            <v-card class="mt-2">
              <v-card-text>
                <div class="d-flex align-center gap-2 mb-4">
                  <v-btn prepend-icon="mdi-package-variant" variant="outlined" color="primary" onClick={openPicker}>
                    Обрати з каталогу КП
                  </v-btn>
                  <v-btn prepend-icon="mdi-plus" variant="outlined" onClick={addManual}>
                    Додати вручну
                  </v-btn>
                  {proposalProducts.value.length === 0 && (
                    <v-chip size="small" color="warning" variant="tonal" to="/proposals/products" link>
                      <v-icon start icon="mdi-alert" />
                      Каталог КП порожній — додайте товари
                    </v-chip>
                  )}
                  <v-spacer />
                  {items.value.length > 0 && (
                    <div class="text-body-2 text-right">
                      <div class="text-medium-emphasis">Без ПДВ: <strong>{fmtMoney(grandTotalExVat.value)} грн</strong></div>
                      <div>З ПДВ: <strong class="text-primary text-body-1">{fmtMoney(grandTotal.value)} грн</strong></div>
                    </div>
                  )}
                </div>

                {items.value.length === 0 ? (
                  <v-alert type="info" variant="tonal" icon="mdi-information-outline">
                    Додайте позиції специфікації — оберіть з каталогу КП або введіть вручну
                  </v-alert>
                ) : (
                  <div>
                    {items.value.map((item, idx) => (
                      <v-card key={idx} variant="outlined" class="mb-3 pa-3" style="border-radius:8px;">
                        <v-row dense align="start">
                          <v-col cols={12} md={5}>
                            <v-text-field
                              v-model={item.name}
                              label="Найменування *"
                              density="compact"
                              hide-details
                              variant="underlined"
                            />
                          </v-col>
                          <v-col cols={4} md={1}>
                            <v-text-field
                              v-model={item.qty}
                              label="К-сть"
                              type="number"
                              density="compact"
                              hide-details
                              variant="underlined"
                            />
                          </v-col>
                          <v-col cols={4} md={1}>
                            <v-combobox
                              v-model={item.unit}
                              label="Одн."
                              items={unitOptions}
                              density="compact"
                              hide-details
                              variant="underlined"
                            />
                          </v-col>
                          <v-col cols={4} md={2}>
                            <v-text-field
                              v-model={item.priceExVat}
                              label="Ціна без ПДВ"
                              type="number"
                              density="compact"
                              hide-details
                              variant="underlined"
                              suffix="грн"
                            />
                          </v-col>
                          <v-col cols={6} md={1}>
                            <v-combobox
                              v-model={item.vatPercent}
                              label="ПДВ %"
                              items={vatOptions}
                              item-title="title"
                              item-value="value"
                              density="compact"
                              hide-details
                              variant="underlined"
                            />
                          </v-col>
                          <v-col cols={6} md={2} class="d-flex align-end justify-end pb-1">
                            <div class="text-right">
                              <div class="text-caption text-medium-emphasis">
                                = {fmtMoney(lineExVat(item))} грн
                              </div>
                              <div class="text-body-2 font-weight-bold text-primary">
                                з ПДВ: {fmtMoney(lineTotal(item))} грн
                              </div>
                            </div>
                          </v-col>
                        </v-row>

                        <v-expansion-panels variant="accordion" class="mt-2">
                          <v-expansion-panel>
                            {{
                              title: () => (
                                <span class="text-caption text-medium-emphasis">
                                  {item.highlight
                                    ? `Картка КП: ${item.highlight}`
                                    : 'Картка обладнання (необов\'язково)'}
                                </span>
                              ),
                              text: () => (
                                <v-row dense>
                                  <v-col cols={12} sm={4}>
                                    <v-text-field
                                      v-model={item.highlight}
                                      label="Виділення (напр. «30 кВт»)"
                                      density="compact"
                                      hide-details
                                      variant="outlined"
                                    />
                                  </v-col>
                                  <v-col cols={12} sm={8}>
                                    <v-text-field
                                      v-model={item.spec}
                                      label="Специфікація (напр. «3-фазний гібридний, Deye SUN-30K»)"
                                      density="compact"
                                      hide-details
                                      variant="outlined"
                                    />
                                  </v-col>
                                </v-row>
                              ),
                            }}
                          </v-expansion-panel>
                        </v-expansion-panels>

                        <div class="d-flex justify-end gap-1 mt-1">
                          <v-btn icon="mdi-chevron-up" variant="text" size="x-small"
                            disabled={idx === 0} onClick={() => moveItem(idx, -1)} />
                          <v-btn icon="mdi-chevron-down" variant="text" size="x-small"
                            disabled={idx === items.value.length - 1} onClick={() => moveItem(idx, 1)} />
                          <v-btn icon="mdi-delete-outline" variant="text" size="x-small"
                            color="error" onClick={() => removeItem(idx)} />
                        </div>
                      </v-card>
                    ))}

                    {equipmentCardsCount.value > 0 && (
                      <v-alert type="success" variant="tonal" icon="mdi-card-bulleted-outline" density="compact" class="mt-2">
                        {equipmentCardsCount.value} позицій відображатимуться як картки «Основне обладнання» у PDF
                      </v-alert>
                    )}

                    <v-divider class="my-3" />
                    <div class="d-flex justify-end">
                      <v-table density="compact" style="width:auto;">
                        <tbody>
                          <tr>
                            <td class="text-right pr-4 text-medium-emphasis">Сума без ПДВ:</td>
                            <td class="text-right font-weight-medium">{fmtMoney(grandTotalExVat.value)} грн</td>
                          </tr>
                          <tr>
                            <td class="text-right pr-4 text-medium-emphasis">ПДВ:</td>
                            <td class="text-right">{fmtMoney(grandTotal.value - grandTotalExVat.value)} грн</td>
                          </tr>
                          <tr>
                            <td class="text-right pr-4 font-weight-bold text-primary">Сума з ПДВ:</td>
                            <td class="text-right font-weight-bold text-primary text-h6">
                              {fmtMoney(grandTotal.value)} грн
                            </td>
                          </tr>
                        </tbody>
                      </v-table>
                    </div>
                  </div>
                )}
              </v-card-text>
            </v-card>
          </v-window-item>

          {/* ── Tab: Extras ── */}
          <v-window-item value="extras">
            <v-card class="mt-2">
              <v-card-text>
                <v-row>
                  <v-col cols={12}>
                    <v-textarea
                      v-model={worksDescription.value}
                      label="Монтажні та пусконалагоджувальні роботи"
                      placeholder="Монтаж конструкцій, установка обладнання, прокладка кабелів, налаштування та введення в експлуатацію"
                      rows={3}
                      auto-grow
                      variant="outlined"
                      prepend-inner-icon="mdi-wrench-outline"
                      hint="Відображається у блоці «МОНТАЖНІ ТА ПУСКОНАЛАГОДЖУВАЛЬНІ РОБОТИ» у PDF"
                      persistent-hint
                    />
                  </v-col>
                  <v-col cols={12} class="mt-2">
                    <v-textarea
                      v-model={techSpecs.value}
                      label="Технічні характеристики системи"
                      placeholder={`Пікова потужність ФЕМ: 10,35 кВт (23 × 450W)\nЄмність АКБ: 71,68 кВт·год LiFePO4\nПотужність інвертора: 30 кВт, 3-фазний гібридний Deye SUN-30K`}
                      rows={6}
                      auto-grow
                      variant="outlined"
                      prepend-inner-icon="mdi-format-list-bulleted"
                      hint="Кожен рядок «Назва: Значення» розбивається на дві колонки у PDF"
                      persistent-hint
                    />
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-window-item>

        </v-window>

        {/* Bottom bar */}
        <v-card class="mt-4" variant="tonal">
          <v-card-text class="py-2">
            <div class="d-flex align-center gap-3">
              <div class="text-body-2 text-medium-emphasis">
                {isNew.value
                  ? 'Заповніть форму та збережіть КП'
                  : `Оновлено: ${loadedProposal.value ? new Date(loadedProposal.value.updatedAt).toLocaleString('uk-UA') : '—'}`}
              </div>
              <v-spacer />
              {!isNew.value && (
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
              )}
              <v-btn
                color="primary"
                variant="elevated"
                prepend-icon={isNew.value ? 'mdi-plus' : 'mdi-content-save'}
                loading={saving.value}
                disabled={!isValid.value}
                onClick={save}
              >
                {isNew.value ? 'Створити КП' : 'Зберегти зміни'}
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        {/* Product picker dialog */}
        <v-dialog v-model={productPickerDialog.value} max-width={660} scrollable>
          <v-card>
            <v-card-title class="d-flex align-center pa-4 pb-2">
              Оберіть товари з каталогу КП
              <v-spacer />
              <v-btn
                icon="mdi-cog-outline"
                variant="text"
                size="small"
                to="/proposals/products"
                title="Редагувати каталог"
              />
              <v-btn icon="mdi-close" variant="text" size="small" onClick={() => (productPickerDialog.value = false)} />
            </v-card-title>
            <v-card-text class="pb-1">
              <v-row dense>
                <v-col cols={12} sm={7}>
                  <v-text-field
                    v-model={pickerSearch.value}
                    label="Пошук"
                    prepend-inner-icon="mdi-magnify"
                    clearable
                    hide-details
                    density="compact"
                    variant="outlined"
                  />
                </v-col>
                <v-col cols={12} sm={5}>
                  <v-select
                    v-model={pickerGroupFilter.value}
                    label="Група"
                    items={pickerGroupOptions.value}
                    item-title="title"
                    item-value="value"
                    clearable
                    hide-details
                    density="compact"
                    variant="outlined"
                  />
                </v-col>
              </v-row>
            </v-card-text>
            <v-list style="max-height:380px;overflow-y:auto;">
              {pickerItems.value.length === 0 ? (
                <v-list-item>
                  <v-list-item-title class="text-medium-emphasis">
                    {proposalProducts.value.length === 0
                      ? 'Каталог КП порожній — спочатку додайте товари'
                      : 'Нічого не знайдено'}
                  </v-list-item-title>
                </v-list-item>
              ) : (
                pickerItems.value.map((p: any) => (
                  <v-list-item key={p.id} onClick={() => togglePicker(p.id)}>
                    {{
                      prepend: () => (
                        <v-checkbox-btn
                          modelValue={pickerSelected.value.has(p.id)}
                          onUpdate:modelValue={() => togglePicker(p.id)}
                          color="primary"
                          onClick={(e: Event) => e.stopPropagation()}
                        />
                      ),
                      default: () => (
                        <div>
                          <div class="text-body-2 font-weight-medium">{p.name}</div>
                          <div class="text-caption text-medium-emphasis">
                            {[p.groupName, p.sku, p.unit].filter(Boolean).join(' · ')}
                            <v-chip size="x-small" color="success" variant="tonal" class="ml-1">
                              {Number(p.priceExVat).toLocaleString('uk-UA')} грн
                              {Number(p.vatPercent) > 0 ? ` + ${Number(p.vatPercent)}% ПДВ` : ' (без ПДВ)'}
                            </v-chip>
                          </div>
                        </div>
                      ),
                    }}
                  </v-list-item>
                ))
              )}
            </v-list>
            <v-divider />
            <v-card-actions class="pa-3">
              <span class="text-caption text-medium-emphasis">Обрано: {pickerSelected.value.size}</span>
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (productPickerDialog.value = false)}>Скасувати</v-btn>
              <v-btn color="primary" variant="elevated" onClick={applyPicker}>Підтвердити</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
