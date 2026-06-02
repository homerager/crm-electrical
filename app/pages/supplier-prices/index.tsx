export default defineComponent({
  name: 'SupplierPricesPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({ title: 'Прайс-листи постачальників' })

    const { isPrivileged } = useAuth()
    const toast = useToast()

    const search = ref('')
    const filterContractorId = ref<string | null>(null)
    const filterProductId = ref<string | null>(null)
    const activeOnly = ref(false)

    const query = computed(() => {
      const q: Record<string, string> = {}
      if (search.value) q.search = search.value
      if (filterContractorId.value) q.contractorId = filterContractorId.value
      if (filterProductId.value) q.productId = filterProductId.value
      if (activeOnly.value) q.activeOnly = 'true'
      return q
    })

    const { data, refresh, pending } = useFetch('/api/supplier-prices', { query })
    const prices = computed(() => (data.value as any)?.prices ?? [])

    const { data: contractorsData } = useFetch('/api/contractors')
    const contractors = computed(() => (contractorsData.value as any)?.contractors ?? [])
    const { data: productsData } = useFetch('/api/products')
    const products = computed(() => (productsData.value as any)?.products ?? [])

    const { data: settingsData } = useFetch('/api/settings')
    const defaultVatPercent = computed(() => {
      const s = (settingsData.value as any)?.settings
      return s?.defaultVatPercent != null ? Number(s.defaultVatPercent) : 0
    })

    const dialog = ref(false)
    const deleteDialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const editItem = ref<any>(null)
    const deleteItem = ref<any>(null)

    const today = () => new Date().toISOString().split('T')[0]

    const form = reactive({
      contractorId: '' as string,
      productId: '' as string,
      price: 0 as number,
      currency: 'UAH',
      vatPercent: 0 as number,
      validFrom: today(),
      validTo: '' as string,
      isActive: true,
      note: '',
    })

    const currencyOptions = ['UAH', 'USD', 'EUR']

    function openCreate() {
      editItem.value = null
      Object.assign(form, {
        contractorId: filterContractorId.value || '',
        productId: filterProductId.value || '',
        price: 0,
        currency: 'UAH',
        vatPercent: defaultVatPercent.value,
        validFrom: today(),
        validTo: '',
        isActive: true,
        note: '',
      })
      error.value = ''
      dialog.value = true
    }

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(form, {
        contractorId: item.contractorId,
        productId: item.productId,
        price: Number(item.price),
        currency: item.currency || 'UAH',
        vatPercent: Number(item.vatPercent),
        validFrom: item.validFrom ? new Date(item.validFrom).toISOString().split('T')[0] : today(),
        validTo: item.validTo ? new Date(item.validTo).toISOString().split('T')[0] : '',
        isActive: item.isActive,
        note: item.note || '',
      })
      error.value = ''
      dialog.value = true
    }

    function openDelete(item: any) {
      deleteItem.value = item
      deleteDialog.value = true
    }

    async function save() {
      error.value = ''
      if (!form.contractorId) {
        error.value = 'Оберіть постачальника'
        return
      }
      if (!form.productId) {
        error.value = 'Оберіть товар'
        return
      }
      saving.value = true
      const isEdit = !!editItem.value
      try {
        const payload = {
          contractorId: form.contractorId,
          productId: form.productId,
          price: Number(form.price) || 0,
          currency: form.currency || 'UAH',
          vatPercent: Number(form.vatPercent) || 0,
          validFrom: form.validFrom || undefined,
          validTo: form.validTo || null,
          isActive: form.isActive,
          note: form.note || null,
        }
        if (isEdit) {
          await $fetch(`/api/supplier-prices/${editItem.value.id}`, { method: 'PUT', body: payload })
        } else {
          await $fetch('/api/supplier-prices', { method: 'POST', body: payload })
        }
        dialog.value = false
        await refresh()
        toast.success(isEdit ? 'Ціну оновлено' : 'Ціну додано')
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
        toast.error(error.value)
      } finally {
        saving.value = false
      }
    }

    async function confirmDelete() {
      if (!deleteItem.value) return
      try {
        await $fetch(`/api/supplier-prices/${deleteItem.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
        toast.success('Ціну видалено')
      } catch (e: any) {
        toast.error(e?.data?.statusMessage || 'Помилка видалення')
      }
    }

    // ---- Import ----
    const importDialog = ref(false)
    const importFile = ref<File | null>(null)
    const importContractorId = ref<string | null>(null)
    const importParsing = ref(false)
    const importLoading = ref(false)
    const importError = ref('')
    const importRows = ref<Array<{ contractor: string; sku: string; product: string; price: string; currency: string; vatPercent: string; validFrom: string; validTo: string; note: string }>>([])
    const importFileIssues = ref<string[]>([])
    const importResult = ref<{ created: number; updated: number; totalRows: number; errors: { row: number; message: string }[] } | null>(null)

    const HEADER_ALIASES: Record<string, string[]> = {
      contractor: ['contractor', 'постачальник', 'контрагент', 'supplier'],
      sku: ['sku', 'артикул', 'код', 'код товару'],
      product: ['product', 'товар', 'назва', 'найменування', 'product name'],
      price: ['price', 'ціна', 'цена', 'price exvat', 'ціна без пдв'],
      currency: ['currency', 'валюта'],
      vatPercent: ['vat', 'пдв', 'vatpercent', 'пдв %', 'vat %'],
      validFrom: ['validfrom', 'valid from', 'дата', 'дата початку', 'з'],
      validTo: ['validto', 'valid to', 'дата завершення', 'по', 'до'],
      note: ['note', 'примітка', 'коментар', 'comment'],
    }

    function detectHeaderKey(header: string): string | null {
      const norm = header.toString().trim().toLowerCase()
      for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
        if (aliases.some((a) => a.toLowerCase() === norm)) return key
      }
      return null
    }

    function openImport() {
      importFile.value = null
      importContractorId.value = filterContractorId.value || null
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
          const key = detectHeaderKey(h)
          if (key) headerMap[i] = key
        })
        const keys = Object.values(headerMap)
        if (!keys.includes('price')) {
          throw new Error('Не знайдено колонку з ціною. Очікувані варіанти: price, ціна')
        }
        if (!keys.includes('sku') && !keys.includes('product')) {
          throw new Error('Не знайдено колонку з товаром (sku або product/назва)')
        }

        const parsed: typeof importRows.value = []
        const issues: string[] = []
        for (let r = 1; r < rows.length; r++) {
          const cells = rows[r] as any[]
          if (!cells || cells.every((c) => !String(c ?? '').trim())) continue
          const row: any = { contractor: '', sku: '', product: '', price: '', currency: '', vatPercent: '', validFrom: '', validTo: '', note: '' }
          for (const [iStr, key] of Object.entries(headerMap)) {
            row[key] = String(cells[Number(iStr)] ?? '').trim()
          }
          const rowNum = r + 1
          if (!row.price) {
            issues.push(`Рядок ${rowNum}: порожня ціна — пропущено`)
            continue
          }
          if (!row.sku && !row.product) {
            issues.push(`Рядок ${rowNum}: не вказано товар — пропущено`)
            continue
          }
          parsed.push(row)
        }

        importRows.value = parsed
        importFileIssues.value = issues
        if (!parsed.length) importError.value = 'Не знайдено жодного валідного рядка для імпорту'
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
        const res = await $fetch<{ created: number; updated: number; totalRows: number; errors: { row: number; message: string }[] }>(
          '/api/supplier-prices/bulk-import',
          { method: 'POST', body: { items: importRows.value, contractorId: importContractorId.value || undefined } },
        )
        importResult.value = res
        if (res.created > 0 || res.updated > 0) {
          toast.success(`Імпортовано: додано ${res.created}, оновлено ${res.updated}`)
          await refresh()
        } else if (res.errors.length) {
          toast.error('Жодної ціни не імпортовано')
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
        ['contractor', 'sku', 'product', 'price', 'currency', 'vat', 'validFrom', 'validTo', 'note'].join(','),
        ['ТОВ Постачальник', 'CAB-001', 'Кабель ВВГ 3x2.5', '45.50', 'UAH', '20', '2026-06-01', '', 'Опт від 100м'].join(','),
        ['ФОП Іванов', 'SW-101', 'Вимикач одноклавішний', '32.00', 'UAH', '20', '2026-06-01', '', ''].join(','),
      ].join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'supplier-prices-template.csv'
      a.click()
      URL.revokeObjectURL(url)
    }

    const importPreviewHeaders = [
      { title: 'Постачальник', key: 'contractor' },
      { title: 'Артикул', key: 'sku' },
      { title: 'Товар', key: 'product' },
      { title: 'Ціна', key: 'price', width: 90 },
      { title: 'Валюта', key: 'currency', width: 80 },
      { title: 'ПДВ', key: 'vatPercent', width: 70 },
      { title: 'З', key: 'validFrom' },
      { title: 'До', key: 'validTo' },
    ]

    const headers = [
      { title: 'Товар', key: 'product' },
      { title: 'Постачальник', key: 'contractor' },
      { title: 'Ціна без ПДВ', key: 'price', align: 'end' as const, width: 140 },
      { title: 'ПДВ', key: 'vatPercent', width: 90 },
      { title: 'Дія', key: 'validity', sortable: false, width: 200 },
      { title: 'Статус', key: 'isActive', width: 110 },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 110 },
    ]

    function fmtPrice(value: number, currency: string) {
      const symbol = currency === 'UAH' ? '₴' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : ''
      return `${symbol}${Number(value).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    function fmtDate(d: string | null) {
      return d ? new Date(d).toLocaleDateString('uk-UA') : '—'
    }

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Прайс-листи постачальників</div>
          <v-spacer />
          <TableExportBtn
            class="mr-2"
            filename="Прайс-листи постачальників"
            rows={prices.value}
            columns={[
              { title: 'Товар', key: 'product.name' },
              { title: 'Артикул', key: 'product.sku' },
              { title: 'Постачальник', key: 'contractor.name' },
              { title: 'Ціна без ПДВ', key: 'price', format: (v) => Number(v) },
              { title: 'Валюта', key: 'currency' },
              { title: 'ПДВ %', key: 'vatPercent', format: (v) => Number(v) },
              { title: 'Дія з', key: 'validFrom', format: (v) => (v ? new Date(v).toLocaleDateString('uk-UA') : '') },
              { title: 'Дія до', key: 'validTo', format: (v) => (v ? new Date(v).toLocaleDateString('uk-UA') : '') },
              { title: 'Активна', key: 'isActive', format: (v) => (v ? 'Так' : 'Ні') },
              { title: 'Примітка', key: 'note' },
            ]}
          />
          {isPrivileged.value && (
            <>
              <v-btn color="secondary" variant="outlined" prepend-icon="mdi-upload" onClick={openImport} class="mr-2">
                Імпорт з Excel/CSV
              </v-btn>
              <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
                Додати ціну
              </v-btn>
            </>
          )}
        </div>

        <v-card>
          <v-card-text class="pb-0">
            <v-row>
              <v-col cols={12} sm={6} md={4}>
                <v-text-field
                  v-model={search.value}
                  label="Пошук за товаром або артикулом"
                  prepend-inner-icon="mdi-magnify"
                  clearable
                  hide-details
                />
              </v-col>
              <v-col cols={12} sm={6} md={3}>
                <v-autocomplete
                  v-model={filterContractorId.value}
                  label="Постачальник"
                  items={contractors.value}
                  item-title="name"
                  item-value="id"
                  prepend-inner-icon="mdi-domain"
                  clearable
                  hide-details
                />
              </v-col>
              <v-col cols={12} sm={6} md={3}>
                <v-autocomplete
                  v-model={filterProductId.value}
                  label="Товар"
                  items={products.value}
                  item-title="name"
                  item-value="id"
                  prepend-inner-icon="mdi-package-variant-closed"
                  clearable
                  hide-details
                />
              </v-col>
              <v-col cols={12} sm={6} md={2} class="d-flex align-center">
                <v-switch
                  v-model={activeOnly.value}
                  label="Лише активні"
                  color="primary"
                  density="compact"
                  hide-details
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-data-table headers={headers} items={prices.value} loading={pending.value} hover>
            {{
              'item.product': ({ item }: any) => (
                <div>
                  <div class="font-weight-medium">{item.product?.name ?? '—'}</div>
                  {item.product?.sku && <div class="text-caption text-medium-emphasis">{item.product.sku}</div>}
                </div>
              ),
              'item.contractor': ({ item }: any) => (
                <v-chip size="small" variant="tonal" color="secondary" prepend-icon="mdi-domain">
                  {item.contractor?.name ?? '—'}
                </v-chip>
              ),
              'item.price': ({ item }: any) => (
                <strong>{fmtPrice(Number(item.price), item.currency)}</strong>
              ),
              'item.vatPercent': ({ item }: any) => (
                <span>{Number(item.vatPercent)}%</span>
              ),
              'item.validity': ({ item }: any) => (
                <span class="text-caption">
                  {fmtDate(item.validFrom)} — {fmtDate(item.validTo)}
                </span>
              ),
              'item.isActive': ({ item }: any) => (
                item.isActive
                  ? <v-chip size="small" color="success" variant="tonal">Активна</v-chip>
                  : <v-chip size="small" color="grey" variant="tonal">Неактивна</v-chip>
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

        <v-dialog v-model={dialog.value} max-width={560}>
          <v-card>
            <v-card-title>{editItem.value ? 'Редагувати ціну' : 'Нова ціна постачальника'}</v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-autocomplete
                v-model={form.contractorId}
                label="Постачальник *"
                items={contractors.value}
                item-title="name"
                item-value="id"
                prepend-inner-icon="mdi-domain"
                class="mb-3"
              />
              <v-autocomplete
                v-model={form.productId}
                label="Товар *"
                items={products.value}
                item-title="name"
                item-value="id"
                prepend-inner-icon="mdi-package-variant-closed"
                class="mb-3"
              />
              <v-row>
                <v-col cols={12} sm={5}>
                  <v-text-field v-model={form.price} label="Ціна без ПДВ *" type="number" min={0} step={0.01} prefix="₴" hide-details />
                </v-col>
                <v-col cols={6} sm={4}>
                  <v-select v-model={form.currency} label="Валюта" items={currencyOptions} hide-details />
                </v-col>
                <v-col cols={6} sm={3}>
                  <v-text-field v-model={form.vatPercent} label="ПДВ %" type="number" min={0} max={100} step={1} suffix="%" hide-details />
                </v-col>
              </v-row>
              <v-row class="mt-0">
                <v-col cols={12} sm={6}>
                  <v-text-field v-model={form.validFrom} label="Дія з *" type="date" hide-details />
                </v-col>
                <v-col cols={12} sm={6}>
                  <v-text-field v-model={form.validTo} label="Дія до (опц.)" type="date" clearable hide-details />
                </v-col>
              </v-row>
              <v-textarea v-model={form.note} label="Примітка" rows={2} class="mt-3" hide-details />
              <v-switch v-model={form.isActive} label="Активна ціна" color="primary" class="mt-2" hide-details />
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (dialog.value = false)}>Скасувати</v-btn>
              <v-btn color="primary" variant="elevated" loading={saving.value} disabled={!form.contractorId || !form.productId} onClick={save}>
                {editItem.value ? 'Зберегти' : 'Додати'}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model={importDialog.value} max-width={900} persistent={importLoading.value} scrollable>
          <v-card>
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-file-upload</v-icon>
              Імпорт прайс-листа
            </v-card-title>
            <v-card-text style="max-height: 70vh;">
              {!importResult.value && (
                <>
                  <v-alert type="info" variant="tonal" class="mb-3" density="compact">
                    Очікувані колонки: <strong>contractor</strong> (постачальник), <strong>sku</strong> або <strong>product</strong> (товар), <strong>price</strong> (ціна), <strong>currency</strong>, <strong>vat</strong>, <strong>validFrom</strong>, <strong>validTo</strong>, <strong>note</strong>. Обовʼязкові: ціна та товар. Товар шукається за артикулом або назвою (мають вже існувати).
                  </v-alert>
                  <div class="d-flex align-center mb-3">
                    <v-btn variant="text" size="small" prepend-icon="mdi-download" onClick={downloadImportTemplate}>
                      Завантажити шаблон CSV
                    </v-btn>
                  </div>
                  <v-autocomplete
                    v-model={importContractorId.value}
                    label="Постачальник для всіх рядків (опц., перевизначає колонку contractor)"
                    items={contractors.value}
                    item-title="name"
                    item-value="id"
                    prepend-inner-icon="mdi-domain"
                    clearable
                    class="mb-3"
                    hide-details
                  />
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
                        До імпорту: <strong>{importRows.value.length}</strong> рядків
                      </div>
                      <v-data-table headers={importPreviewHeaders} items={importRows.value} density="compact" items-per-page={10} />
                    </>
                  )}
                </>
              )}
              {importResult.value && (
                <>
                  <v-alert
                    type={importResult.value.created > 0 || importResult.value.updated > 0 ? 'success' : 'warning'}
                    variant="tonal"
                    class="mb-3"
                  >
                    Додано <strong>{importResult.value.created}</strong>, оновлено <strong>{importResult.value.updated}</strong> з {importResult.value.totalRows} рядків
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

        <v-dialog v-model={deleteDialog.value} max-width={420}>
          <v-card>
            <v-card-title>Видалити ціну?</v-card-title>
            <v-card-text>
              Ціну на "{deleteItem.value?.product?.name}" від "{deleteItem.value?.contractor?.name}" буде видалено.
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (deleteDialog.value = false)}>Скасувати</v-btn>
              <v-btn color="error" variant="elevated" onClick={confirmDelete}>Видалити</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
