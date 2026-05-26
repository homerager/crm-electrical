export default defineComponent({
  name: 'ProposalProductsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Товари для КП' })

    const { isPrivileged } = useAuth()
    const toast = useToast()

    const { data, refresh, pending } = useFetch('/api/proposal-products', { query: { active: 'false' } })
    const items = computed(() => (data.value as any)?.items ?? [])

    const search = ref('')
    const filterGroup = ref<string | null>(null)

    const groups = computed(() => {
      const set = new Set<string>()
      for (const i of items.value) if (i.groupName) set.add(i.groupName)
      return Array.from(set).sort()
    })

    const filtered = computed(() => {
      let list = items.value
      if (search.value) {
        const q = search.value.toLowerCase()
        list = list.filter(
          (i: any) =>
            i.name.toLowerCase().includes(q) ||
            (i.sku || '').toLowerCase().includes(q) ||
            (i.groupName || '').toLowerCase().includes(q),
        )
      }
      if (filterGroup.value) {
        list = list.filter((i: any) => i.groupName === filterGroup.value)
      }
      return list
    })

    /* ── Dialog ── */
    const dialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const editItem = ref<any>(null)

    const form = reactive({
      name: '',
      description: '',
      sku: '',
      unit: 'шт',
      groupName: '',
      priceExVat: '',
      vatPercent: '20',
      notes: '',
      isActive: true,
    })

    const priceWithVat = computed(() => {
      const base = parseFloat(form.priceExVat) || 0
      const vat = parseFloat(form.vatPercent) || 0
      return base * (1 + vat / 100)
    })

    function openCreate() {
      editItem.value = null
      Object.assign(form, {
        name: '',
        description: '',
        sku: '',
        unit: 'шт',
        groupName: '',
        priceExVat: '',
        vatPercent: '20',
        notes: '',
        isActive: true,
      })
      error.value = ''
      dialog.value = true
    }

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(form, {
        name: item.name,
        description: item.description || '',
        sku: item.sku || '',
        unit: item.unit,
        groupName: item.groupName || '',
        priceExVat: String(Number(item.priceExVat)),
        vatPercent: String(Number(item.vatPercent)),
        notes: item.notes || '',
        isActive: item.isActive,
      })
      error.value = ''
      dialog.value = true
    }

    async function save() {
      saving.value = true
      error.value = ''
      try {
        const body = {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          sku: form.sku.trim() || undefined,
          unit: form.unit,
          groupName: form.groupName.trim() || undefined,
          priceExVat: parseFloat(form.priceExVat) || 0,
          vatPercent: parseFloat(form.vatPercent) || 0,
          notes: form.notes.trim() || undefined,
          isActive: form.isActive,
        }
        const isEdit = !!editItem.value
        if (editItem.value) {
          await $fetch(`/api/proposal-products/${editItem.value.id}`, { method: 'PUT', body })
        } else {
          await $fetch('/api/proposal-products', { method: 'POST', body })
        }
        dialog.value = false
        await refresh()
        toast.success(isEdit ? 'Товар оновлено' : 'Товар створено')
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
        toast.error(error.value)
      } finally {
        saving.value = false
      }
    }

    /* ── Bulk import ── */
    const importDialog = ref(false)
    const importFile = ref<File | null>(null)
    const importParsing = ref(false)
    const importLoading = ref(false)
    const importError = ref('')
    const importRows = ref<Array<{ name: string; sku: string; unit: string; description: string; groupName: string; priceExVat: string; vatPercent: string; notes: string }>>([])
    const importFileIssues = ref<string[]>([])
    const importResult = ref<{ created: number; totalRows: number; errors: { row: number; message: string }[] } | null>(null)

    const IMPORT_HEADER_ALIASES: Record<string, string[]> = {
      name: ['name', 'назва', 'найменування', 'товар', 'продукт'],
      sku: ['sku', 'артикул', 'код'],
      unit: ['unit', 'одиниця', 'од.', 'од. виміру', 'одиниця виміру', 'од'],
      description: ['description', 'опис'],
      groupName: ['group', 'група', 'категорія', 'group name'],
      priceExVat: ['price', 'ціна', 'ціна без пдв', 'priceexvat', 'price ex vat'],
      vatPercent: ['vat', 'пдв', 'пдв %', 'vatpercent', 'vat percent', 'пдв,%'],
      notes: ['notes', 'примітки', 'коментар'],
    }

    function detectImportHeader(header: string): string | null {
      const norm = header.toString().trim().toLowerCase()
      for (const [key, aliases] of Object.entries(IMPORT_HEADER_ALIASES)) {
        if (aliases.some((a) => a.toLowerCase() === norm)) return key
      }
      return null
    }

    function openImport() {
      importFile.value = null
      importRows.value = []
      importFileIssues.value = []
      importResult.value = null
      importError.value = ''
      importDialog.value = true
    }

    async function onImportFileChange(value: File | File[] | null) {
      const file = Array.isArray(value) ? value[0] : value
      importFile.value = file || null
      importRows.value = []
      importFileIssues.value = []
      importResult.value = null
      importError.value = ''
      if (!file) return

      importParsing.value = true
      try {
        const XLSX: any = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        const firstSheetName = wb.SheetNames[0]
        if (!firstSheetName) throw new Error('Файл не містить аркушів')
        const sheet = wb.Sheets[firstSheetName]
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
        if (!rows.length) throw new Error('Файл порожній')

        const headerRow = (rows[0] as any[]).map((h: any) => (h == null ? '' : String(h)))
        const headerMap: Record<number, string> = {}
        headerRow.forEach((h: string, i: number) => {
          const key = detectImportHeader(h)
          if (key) headerMap[i] = key
        })
        const hasName = Object.values(headerMap).includes('name')
        if (!hasName) {
          throw new Error('Не знайдено колонку з назвою. Очікувані варіанти: name, назва, найменування')
        }

        const parsed: typeof importRows.value = []
        const issues: string[] = []

        for (let r = 1; r < rows.length; r++) {
          const cells = rows[r] as any[]
          if (!cells || cells.every((c) => !String(c ?? '').trim())) continue
          const row: any = { name: '', sku: '', unit: '', description: '', groupName: '', priceExVat: '', vatPercent: '', notes: '' }
          for (const [iStr, key] of Object.entries(headerMap)) {
            const i = Number(iStr)
            row[key] = String(cells[i] ?? '').trim()
          }
          const rowNum = r + 1
          if (!row.name) {
            issues.push(`Рядок ${rowNum}: порожня назва — пропущено`)
            continue
          }
          parsed.push(row)
        }

        importRows.value = parsed
        importFileIssues.value = issues
        if (!parsed.length) {
          importError.value = 'Не знайдено жодного валідного рядка для імпорту'
        }
      } catch (e: any) {
        importError.value = e?.message || 'Не вдалось прочитати файл'
      } finally {
        importParsing.value = false
      }
    }

    async function runImport() {
      if (!importRows.value.length) return
      importLoading.value = true
      importError.value = ''
      try {
        const res = await $fetch<{ created: number; totalRows: number; errors: { row: number; message: string }[] }>(
          '/api/proposal-products/bulk-import',
          { method: 'POST', body: { items: importRows.value } },
        )
        importResult.value = res
        if (res.created > 0) {
          toast.success(`Імпортовано ${res.created} ${res.created === 1 ? 'товар' : 'товарів'}`)
          await refresh()
        }
        if (res.created === 0 && res.errors.length) {
          toast.error('Жодного товару не імпортовано')
        }
      } catch (e: any) {
        importError.value = e?.data?.statusMessage || 'Помилка імпорту'
        toast.error(importError.value)
      } finally {
        importLoading.value = false
      }
    }

    function downloadImportTemplate() {
      const csv = [
        ['name', 'sku', 'unit', 'group', 'price', 'vat', 'description', 'notes'].join(','),
        ['Монтаж розетки', 'SRV-001', 'шт', 'Послуги', '150.00', '20', 'Установка побутової розетки', ''].join(','),
        ['Кабель ВВГ 3x2.5', 'CAB-001', 'м', 'Кабельна продукція', '85.50', '20', '', ''].join(','),
      ].join('\n')
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'proposal-products-template.csv'
      a.click()
      URL.revokeObjectURL(url)
    }

    const importPreviewHeaders = [
      { title: 'Назва', key: 'name' },
      { title: 'Артикул', key: 'sku' },
      { title: 'Од.', key: 'unit', width: 70 },
      { title: 'Група', key: 'groupName' },
      { title: 'Ціна', key: 'priceExVat', align: 'end' as const },
      { title: 'ПДВ', key: 'vatPercent', align: 'end' as const },
    ]

    /* ── Delete ── */
    const deleteDialog = ref(false)
    const deleteItem = ref<any>(null)
    const deleteError = ref('')

    function openDelete(item: any) {
      deleteItem.value = item
      deleteError.value = ''
      deleteDialog.value = true
    }

    async function confirmDelete() {
      deleteError.value = ''
      try {
        await $fetch(`/api/proposal-products/${deleteItem.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
        toast.success('Товар видалено')
      } catch (e: any) {
        deleteError.value = e?.data?.statusMessage || 'Помилка видалення'
        toast.error(deleteError.value)
      }
    }

    function fmtMoney(n: number) {
      return n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const unitOptions = ['шт', 'м', 'м²', 'м³', 'кг', 'т', 'л', 'уп', 'к-т', 'пог.м', 'компл.', 'послуга']
    const vatOptions = [
      { title: 'Без ПДВ (0%)', value: '0' },
      { title: '7%', value: '7' },
      { title: '20%', value: '20' },
    ]

    const headers = [
      { title: 'Назва', key: 'name' },
      { title: 'Артикул', key: 'sku', width: 110 },
      { title: 'Група', key: 'groupName', width: 140 },
      { title: 'Одн.', key: 'unit', width: 70 },
      { title: 'Ціна без ПДВ', key: 'priceExVat', sortable: false, align: 'end' as const, width: 130 },
      { title: 'ПДВ %', key: 'vatPercent', sortable: false, align: 'center' as const, width: 80 },
      { title: 'Ціна з ПДВ', key: 'priceWithVat', sortable: false, align: 'end' as const, width: 130 },
      { title: 'Статус', key: 'isActive', sortable: false, width: 90 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 90 },
    ]

    const groupOptions = computed(() => [
      { title: 'Всі групи', value: null },
      ...groups.value.map((g) => ({ title: g, value: g })),
    ])

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Товари для КП</div>
          <v-spacer />
          <v-btn variant="outlined" to="/proposals" prepend-icon="mdi-arrow-left" class="mr-2">
            До списку КП
          </v-btn>
          <TableExportBtn
            class="mr-2"
            filename="Товари для КП"
            rows={filtered.value}
            columns={[
              { title: 'Назва', key: 'name' },
              { title: 'Артикул', key: 'sku' },
              { title: 'Одиниця', key: 'unit' },
              { title: 'Група', key: 'groupName' },
              { title: 'Ціна без ПДВ', key: 'priceExVat', format: (v) => Number(v ?? 0) },
              { title: 'ПДВ, %', key: 'vatPercent', format: (v) => Number(v ?? 0) },
              { title: 'Опис', key: 'description' },
              { title: 'Примітки', key: 'notes' },
              { title: 'Активний', key: 'isActive', format: (v) => (v ? 'Так' : 'Ні') },
            ]}
          />
          {isPrivileged.value && (
            <>
              <v-btn color="secondary" variant="outlined" prepend-icon="mdi-upload" onClick={openImport} class="mr-2">
                Імпорт з Excel/CSV
              </v-btn>
              <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
                Додати товар
              </v-btn>
            </>
          )}
        </div>

        <v-alert type="info" variant="tonal" density="compact" class="mb-4" icon="mdi-information-outline">
          Окремий каталог товарів та послуг виключно для комерційних пропозицій.
          Не пов'язаний з основним складом.
        </v-alert>

        <v-card>
          <v-card-text class="pb-0">
            <v-row>
              <v-col cols={12} sm={6}>
                <v-text-field
                  v-model={search.value}
                  label="Пошук за назвою, артикулом або групою"
                  prepend-inner-icon="mdi-magnify"
                  clearable
                  hide-details
                  density="compact"
                />
              </v-col>
              <v-col cols={12} sm={4}>
                <v-select
                  v-model={filterGroup.value}
                  label="Група"
                  items={groupOptions.value}
                  item-title="title"
                  item-value="value"
                  clearable
                  hide-details
                  density="compact"
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-data-table
            headers={headers}
            items={filtered.value}
            loading={pending.value}
            hover
            items-per-page={25}
          >
            {{
              'item.sku': ({ item }: any) => (
                item.sku
                  ? <v-chip size="small" variant="outlined">{item.sku}</v-chip>
                  : <span class="text-medium-emphasis">—</span>
              ),
              'item.groupName': ({ item }: any) => (
                item.groupName
                  ? <v-chip size="small" color="secondary" variant="tonal">{item.groupName}</v-chip>
                  : <span class="text-medium-emphasis">—</span>
              ),
              'item.priceExVat': ({ item }: any) => (
                <span class="font-weight-medium">{fmtMoney(Number(item.priceExVat))} грн</span>
              ),
              'item.vatPercent': ({ item }: any) => (
                Number(item.vatPercent) === 0
                  ? <v-chip size="small" variant="tonal">без ПДВ</v-chip>
                  : <v-chip size="small" variant="tonal" color="info">{Number(item.vatPercent)}%</v-chip>
              ),
              'item.priceWithVat': ({ item }: any) => {
                const total = Number(item.priceExVat) * (1 + Number(item.vatPercent) / 100)
                return <span class="font-weight-bold">{fmtMoney(total)} грн</span>
              },
              'item.isActive': ({ item }: any) => (
                item.isActive
                  ? <v-chip size="small" color="success" variant="tonal">Активний</v-chip>
                  : <v-chip size="small" color="error" variant="tonal">Прихований</v-chip>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end">
                  {isPrivileged.value && (
                    <>
                      <v-btn icon="mdi-pencil" variant="text" size="small" color="primary" onClick={() => openEdit(item)} />
                      <v-btn icon="mdi-delete" variant="text" size="small" color="error" onClick={() => openDelete(item)} />
                    </>
                  )}
                </div>
              ),
            }}
          </v-data-table>
        </v-card>

        {/* Create / Edit dialog */}
        <v-dialog v-model={dialog.value} max-width={600}>
          <v-card>
            <v-card-title class="d-flex align-center gap-2">
              <v-icon icon={editItem.value ? 'mdi-pencil' : 'mdi-plus-circle-outline'} color="primary" />
              {editItem.value ? 'Редагувати товар КП' : 'Новий товар для КП'}
            </v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-row>
                <v-col cols={12}>
                  <v-text-field v-model={form.name} label="Назва *" variant="outlined" hide-details="auto" />
                </v-col>
                <v-col cols={6}>
                  <v-text-field v-model={form.sku} label="Артикул / SKU" variant="outlined" hide-details="auto" />
                </v-col>
                <v-col cols={6}>
                  <v-combobox
                    v-model={form.unit}
                    label="Одиниця виміру"
                    items={unitOptions}
                    variant="outlined"
                    hide-details="auto"
                  />
                </v-col>
                <v-col cols={12}>
                  <v-combobox
                    v-model={form.groupName}
                    label="Група"
                    items={groups.value}
                    variant="outlined"
                    hide-details="auto"
                    placeholder="Введіть або оберіть групу"
                    prepend-inner-icon="mdi-tag-outline"
                  />
                </v-col>
                <v-col cols={7}>
                  <v-text-field
                    v-model={form.priceExVat}
                    label="Ціна без ПДВ *"
                    type="number"
                    suffix="грн"
                    variant="outlined"
                    hide-details="auto"
                    prepend-inner-icon="mdi-cash"
                  />
                </v-col>
                <v-col cols={5}>
                  <v-combobox
                    v-model={form.vatPercent}
                    label="ПДВ %"
                    items={vatOptions}
                    item-title="title"
                    item-value="value"
                    variant="outlined"
                    hide-details="auto"
                  />
                </v-col>
                <v-col cols={12}>
                  <v-alert type="success" variant="tonal" density="compact" icon="mdi-calculator">
                    Ціна з ПДВ: <strong>{fmtMoney(priceWithVat.value)} грн</strong>
                  </v-alert>
                </v-col>
                <v-col cols={12}>
                  <v-textarea v-model={form.description} label="Опис" rows={2} auto-grow variant="outlined" hide-details />
                </v-col>
                <v-col cols={12}>
                  <v-textarea v-model={form.notes} label="Примітка" rows={2} auto-grow variant="outlined" hide-details />
                </v-col>
                {editItem.value && (
                  <v-col cols={12}>
                    <v-switch
                      v-model={form.isActive}
                      label="Активний (відображається при виборі товарів у КП)"
                      color="success"
                      hide-details
                    />
                  </v-col>
                )}
              </v-row>
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (dialog.value = false)}>Скасувати</v-btn>
              <v-btn
                color="primary"
                variant="elevated"
                loading={saving.value}
                disabled={!form.name || !form.priceExVat}
                onClick={save}
              >
                {editItem.value ? 'Зберегти' : 'Створити'}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        {/* Bulk import dialog */}
        <v-dialog v-model={importDialog.value} max-width={900} persistent={importLoading.value} scrollable>
          <v-card>
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-file-upload</v-icon>
              Масовий імпорт товарів для КП
            </v-card-title>
            <v-card-text style="max-height: 70vh;">
              {!importResult.value && (
                <>
                  <v-alert type="info" variant="tonal" class="mb-3" density="compact">
                    Очікувані колонки (перший рядок — заголовки): <strong>name</strong> (або назва), <strong>sku</strong>, <strong>unit</strong>, <strong>group</strong>, <strong>price</strong> (ціна без ПДВ), <strong>vat</strong> (ПДВ %), <strong>description</strong>, <strong>notes</strong>. Обов'язкова лише <strong>name</strong>. Якщо ПДВ не вказано — 20%, одиниця — шт.
                  </v-alert>
                  <div class="d-flex align-center mb-3">
                    <v-btn variant="text" size="small" prepend-icon="mdi-download" onClick={downloadImportTemplate}>
                      Завантажити шаблон CSV
                    </v-btn>
                  </div>
                  <v-file-input
                    label="Файл Excel або CSV"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    prepend-icon="mdi-paperclip"
                    show-size
                    modelValue={importFile.value}
                    onUpdate:modelValue={onImportFileChange}
                    loading={importParsing.value}
                    disabled={importLoading.value}
                    hide-details
                    class="mb-3"
                  />
                  {importError.value && <v-alert type="error" variant="tonal" class="mb-3">{importError.value}</v-alert>}
                  {importFileIssues.value.length > 0 && (
                    <v-alert type="warning" variant="tonal" class="mb-3" density="compact">
                      <div class="font-weight-medium mb-1">Попередження ({importFileIssues.value.length}):</div>
                      <div style="max-height: 120px; overflow-y: auto;">
                        {importFileIssues.value.map((msg, i) => (
                          <div key={i} class="text-caption">• {msg}</div>
                        ))}
                      </div>
                    </v-alert>
                  )}
                  {importRows.value.length > 0 && (
                    <>
                      <div class="text-subtitle-2 mb-2">
                        До імпорту: <strong>{importRows.value.length}</strong> {importRows.value.length === 1 ? 'товар' : 'товарів'}
                      </div>
                      <v-data-table
                        headers={importPreviewHeaders}
                        items={importRows.value}
                        density="compact"
                        items-per-page={10}
                      />
                    </>
                  )}
                </>
              )}
              {importResult.value && (
                <>
                  <v-alert
                    type={importResult.value.created > 0 ? 'success' : 'warning'}
                    variant="tonal"
                    class="mb-3"
                  >
                    Імпортовано <strong>{importResult.value.created}</strong> з {importResult.value.totalRows} рядків
                  </v-alert>
                  {importResult.value.errors.length > 0 && (
                    <v-alert type="error" variant="tonal" density="compact">
                      <div class="font-weight-medium mb-1">Помилки ({importResult.value.errors.length}):</div>
                      <div style="max-height: 300px; overflow-y: auto;">
                        {importResult.value.errors.map((e, i) => (
                          <div key={i} class="text-caption">• Рядок {e.row}: {e.message}</div>
                        ))}
                      </div>
                    </v-alert>
                  )}
                </>
              )}
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" disabled={importLoading.value} onClick={() => (importDialog.value = false)}>
                {importResult.value ? 'Закрити' : 'Скасувати'}
              </v-btn>
              {!importResult.value && (
                <v-btn
                  color="primary"
                  variant="elevated"
                  loading={importLoading.value}
                  disabled={!importRows.value.length || importParsing.value}
                  onClick={runImport}
                >
                  Імпортувати {importRows.value.length > 0 ? `(${importRows.value.length})` : ''}
                </v-btn>
              )}
            </v-card-actions>
          </v-card>
        </v-dialog>

        {/* Delete dialog */}
        <v-dialog v-model={deleteDialog.value} max-width={420}>
          <v-card>
            <v-card-title>Видалити товар?</v-card-title>
            <v-card-text>
              {deleteError.value
                ? <v-alert type="error" variant="tonal">{deleteError.value}</v-alert>
                : <span>«{deleteItem.value?.name}» буде видалено з каталогу товарів для КП.</span>
              }
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (deleteDialog.value = false)}>Скасувати</v-btn>
              {!deleteError.value && (
                <v-btn color="error" variant="elevated" onClick={confirmDelete}>Видалити</v-btn>
              )}
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
