import AuditLogPanel from '~/components/AuditLogPanel'

interface StockLine {
  lotKey: string
  quantity: number
}

export default defineComponent({
  name: 'InstallationWorkDetailPage',

  setup() {
    definePageMeta({ middleware: ['auth'], permission: 'electricalInstallationWorks.view' })

    const route = useRoute()
    const id = route.params.id as string
    const toast = useToast()
    const { can } = useAuth()

    const { data, pending, refresh } = useFetch(`/api/electrical-installation-works/${id}`)
    const work = computed(() => (data.value as any)?.work)
    const objectStock = computed(() => (data.value as any)?.objectStock ?? [])
    const materials = computed(() => work.value?.materials ?? [])

    useHead({ title: computed(() => (work.value ? `${work.value.type}: ${work.value.name}` : 'Монтажна робота')) })

    const uah = (n: number) =>
      `₴${Number(n || 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    const qtyStr = (n: number) => Number(n || 0).toLocaleString('uk-UA', { maximumFractionDigits: 3 })

    const totalAmount = computed(() =>
      materials.value.reduce((s: number, m: any) => s + Number(m.quantity) * Number(m.pricePerUnit), 0),
    )
    const writtenOffCount = computed(() => materials.value.filter((m: any) => m.writtenOff).length)

    const canEdit = computed(() => can('electricalInstallationWorks.edit'))

    // ---- object stock lot options (for the "from stock" mode) -------------------------------
    const lotOptions = computed(() =>
      objectStock.value
        .filter((r: any) => Number(r.quantity) > 0)
        .map((r: any) => {
          const contractorId = r.contractor?.id ?? null
          const price = Number(r.pricePerUnit ?? 0)
          const supplier = r.contractor?.name || 'Без постачальника'
          return {
            key: `${r.productId}|${contractorId ?? ''}|${price.toFixed(2)}`,
            productId: r.productId,
            contractorId,
            pricePerUnit: price,
            vatPercent: Number(r.vatPercent ?? 0),
            unit: r.product.unit,
            maxQty: Number(r.quantity),
            title: `${r.product.name}${r.product.sku ? ` · ${r.product.sku}` : ''} · ${supplier} · ₴${price.toFixed(2)} (${qtyStr(Number(r.quantity))} ${r.product.unit})`,
          }
        }),
    )
    const lotByKey = (key: string) => lotOptions.value.find((l: any) => l.key === key)
    const maxQtyFor = (key: string) => lotByKey(key)?.maxQty ?? 0
    const unitFor = (key: string) => lotByKey(key)?.unit ?? ''

    // ---- add dialog state -------------------------------------------------------------------
    const addOpen = ref(false)
    const saving = ref(false)
    const addErr = ref('')
    const mode = ref<'stock' | 'custom'>('stock')
    const stockLines = ref<StockLine[]>([])
    const customForm = reactive({ name: '', unit: 'шт', quantity: 1, pricePerUnit: 0, note: '' })

    function openAdd() {
      addErr.value = ''
      mode.value = lotOptions.value.length > 0 ? 'stock' : 'custom'
      const first = lotOptions.value[0]
      stockLines.value = [{ lotKey: first?.key ?? '', quantity: 1 }]
      Object.assign(customForm, { name: '', unit: 'шт', quantity: 1, pricePerUnit: 0, note: '' })
      addOpen.value = true
    }
    const addStockLine = () => stockLines.value.push({ lotKey: '', quantity: 1 })
    const removeStockLine = (i: number) => stockLines.value.splice(i, 1)

    async function submitAdd() {
      addErr.value = ''
      let items: any[] = []

      if (mode.value === 'stock') {
        const lines = stockLines.value.filter((l) => l.lotKey)
        if (lines.length === 0) {
          addErr.value = 'Оберіть партію хоча б в одному рядку'
          return
        }
        for (const l of lines) {
          const q = Number(l.quantity)
          if (!Number.isFinite(q) || q <= 0) {
            addErr.value = 'Перевірте кількість у рядках'
            return
          }
          if (q > maxQtyFor(l.lotKey) + 1e-9) {
            addErr.value = `Кількість перевищує залишок на обʼєкті (макс. ${maxQtyFor(l.lotKey)})`
            return
          }
        }
        items = lines.map((l) => {
          const lot = lotByKey(l.lotKey)!
          return {
            kind: 'stock',
            productId: lot.productId,
            contractorId: lot.contractorId,
            pricePerUnit: lot.pricePerUnit,
            vatPercent: lot.vatPercent,
            quantity: Number(l.quantity),
          }
        })
      } else {
        if (!customForm.name.trim()) {
          addErr.value = 'Вкажіть назву позиції'
          return
        }
        if (!(Number(customForm.quantity) > 0)) {
          addErr.value = 'Кількість має бути більшою за 0'
          return
        }
        items = [
          {
            kind: 'custom',
            name: customForm.name.trim(),
            unit: customForm.unit.trim() || 'шт',
            quantity: Number(customForm.quantity),
            pricePerUnit: Number(customForm.pricePerUnit) || 0,
            note: customForm.note.trim() || undefined,
          },
        ]
      }

      saving.value = true
      try {
        await $fetch(`/api/electrical-installation-works/${id}/materials`, { method: 'POST', body: { items } })
        addOpen.value = false
        await refresh()
        toast.success('Матеріали додано')
      } catch (e: any) {
        addErr.value = e?.data?.statusMessage || 'Помилка збереження'
        toast.error(addErr.value)
      } finally {
        saving.value = false
      }
    }

    // ---- delete material --------------------------------------------------------------------
    const delOpen = ref(false)
    const delItem = ref<any>(null)
    function openDeleteMaterial(item: any) {
      delItem.value = item
      delOpen.value = true
    }
    async function confirmDeleteMaterial() {
      if (!delItem.value) return
      try {
        await $fetch(`/api/electrical-installation-works/${id}/materials/${delItem.value.id}`, { method: 'DELETE' })
        delOpen.value = false
        await refresh()
        toast.success('Позицію видалено')
      } catch (e: any) {
        toast.error(e?.data?.statusMessage || 'Помилка видалення')
      }
    }

    const materialHeaders = [
      { title: 'Найменування', key: 'name' },
      { title: 'Тип', key: 'mtype', width: 130, sortable: false },
      { title: 'Од.', key: 'unit', align: 'center' as const, width: 80 },
      { title: 'Кількість', key: 'quantity', align: 'end' as const, width: 120 },
      { title: 'Ціна, ₴', key: 'pricePerUnit', align: 'end' as const, width: 110 },
      { title: 'Сума, ₴', key: 'amount', align: 'end' as const, width: 120 },
      { title: 'Накладні', key: 'invoices', sortable: false, minWidth: 160 },
      { title: '', key: 'actions', sortable: false, align: 'end' as const, width: 70 },
    ]

    function renderInvoices(item: any) {
      const invoices = [
        ...new Map((item.supplyHistory ?? []).map((s: any) => [s.invoice.id, s.invoice])).values(),
      ] as any[]
      if (!invoices.length) return <span class="text-medium-emphasis">—</span>
      const visible = invoices.slice(0, 2)
      const rest = invoices.slice(2)
      return (
        <div class="d-flex flex-wrap ga-1 align-center">
          {visible.map((inv: any) => (
            <v-chip key={inv.id} size="x-small" variant="outlined" to={`/invoices/${inv.id}`}>
              {inv.number} ({new Date(inv.date).toLocaleDateString('uk-UA')})
            </v-chip>
          ))}
          {rest.length > 0 && (
            <v-tooltip>
              {{
                activator: ({ props }: any) => (
                  <v-chip {...props} size="x-small" variant="tonal">+{rest.length}</v-chip>
                ),
                default: () => (
                  <div>
                    {rest.map((inv: any) => (
                      <div key={inv.id}>
                        {inv.number} ({new Date(inv.date).toLocaleDateString('uk-UA')})
                      </div>
                    ))}
                  </div>
                ),
              }}
            </v-tooltip>
          )}
        </div>
      )
    }

    return () => (
      <div>
        <div class="page-toolbar no-print">
          <v-btn variant="outlined" prepend-icon="mdi-arrow-left" to="/electrical-installation-works" class="mr-2">
            Назад
          </v-btn>
          {work.value && (
            <v-chip class="mr-2" color="primary" variant="tonal" size="small">{work.value.type}</v-chip>
          )}
          <div class="text-h5 font-weight-bold">{work.value?.name ?? '...'}</div>
          <v-spacer />
          {work.value && (
            <v-btn
              prepend-icon="mdi-file-pdf-box"
              variant="outlined"
              color="error"
              href={`/api/electrical-installation-works/${id}/pdf`}
              target="_blank"
            >
              PDF
            </v-btn>
          )}
        </div>

        {pending.value && <v-progress-linear indeterminate color="primary" />}

        {work.value && (
          <>
            <v-card variant="outlined" class="mb-4">
              <v-card-text>
                <v-row>
                  <v-col cols={12} md={3}>
                    <div class="text-body-2 text-medium-emphasis">Вид роботи</div>
                    <div class="font-weight-medium">{work.value.type}</div>
                  </v-col>
                  <v-col cols={12} md={3}>
                    <div class="text-body-2 text-medium-emphasis">Обʼєкт</div>
                    <nuxt-link to={`/objects`} class="text-primary text-decoration-none font-weight-medium">
                      {work.value.object?.name ?? '—'}
                    </nuxt-link>
                    {work.value.object?.address && (
                      <div class="text-caption text-medium-emphasis">{work.value.object.address}</div>
                    )}
                  </v-col>
                  <v-col cols={12} md={2}>
                    <div class="text-body-2 text-medium-emphasis">Замовник</div>
                    <div>{work.value.object?.client?.name ?? '—'}</div>
                  </v-col>
                  <v-col cols={12} md={2}>
                    <div class="text-body-2 text-medium-emphasis">Автор</div>
                    <div>{work.value.createdBy?.name ?? '—'}</div>
                  </v-col>
                  <v-col cols={12} md={2}>
                    <div class="text-body-2 text-medium-emphasis">Дата</div>
                    <div>{new Date(work.value.createdAt).toLocaleDateString('uk-UA')}</div>
                  </v-col>
                </v-row>
                {work.value.description && (
                  <div class="mt-3">
                    <div class="text-body-2 text-medium-emphasis">Опис</div>
                    <div>{work.value.description}</div>
                  </div>
                )}
              </v-card-text>
            </v-card>

            <v-card variant="outlined" class="mb-4">
              <v-card-title class="d-flex align-center flex-wrap gap-2">
                <v-icon class="mr-2" icon="mdi-fuse" size="small" />
                Використані матеріали
                <v-chip size="small" variant="tonal" color="primary">{materials.value.length} позицій</v-chip>
                {writtenOffCount.value > 0 && (
                  <v-chip size="small" variant="tonal" color="success">
                    списано з обʼєкта: {writtenOffCount.value}
                  </v-chip>
                )}
                <v-spacer />
                {canEdit.value && (
                  <v-btn color="primary" variant="tonal" size="small" prepend-icon="mdi-plus" onClick={openAdd}>
                    Додати матеріал
                  </v-btn>
                )}
              </v-card-title>

              {materials.value.length === 0 ? (
                <v-card-text class="d-flex flex-column align-center justify-center py-8">
                  <v-icon icon="mdi-package-variant-remove" size="48" class="text-medium-emphasis mb-2" />
                  <span class="text-body-2 text-medium-emphasis">Матеріали ще не додані</span>
                </v-card-text>
              ) : (
                <>
                  <v-data-table
                    headers={materialHeaders}
                    items={materials.value}
                    hide-default-footer
                    items-per-page={-1}
                    density="compact"
                  >
                    {{
                      'item.name': ({ item }: any) => (
                        <div>
                          <span class="font-weight-medium">{item.name}</span>
                          {item.product?.sku && (
                            <span class="text-caption text-medium-emphasis ml-2">{item.product.sku}</span>
                          )}
                          {item.contractor?.name && (
                            <div class="text-caption text-medium-emphasis">{item.contractor.name}</div>
                          )}
                          {item.note && <div class="text-caption text-medium-emphasis fst-italic">{item.note}</div>}
                        </div>
                      ),
                      'item.mtype': ({ item }: any) =>
                        item.writtenOff ? (
                          <v-chip size="x-small" variant="tonal" color="success">Списано з обʼєкта</v-chip>
                        ) : (
                          <v-chip size="x-small" variant="tonal">Довільна</v-chip>
                        ),
                      'item.quantity': ({ item }: any) => <strong>{qtyStr(Number(item.quantity))}</strong>,
                      'item.pricePerUnit': ({ item }: any) =>
                        Number(item.pricePerUnit) > 0 ? (
                          <span>{uah(Number(item.pricePerUnit))}</span>
                        ) : (
                          <span class="text-medium-emphasis">—</span>
                        ),
                      'item.amount': ({ item }: any) =>
                        Number(item.pricePerUnit) > 0 ? (
                          <strong>{uah(Number(item.quantity) * Number(item.pricePerUnit))}</strong>
                        ) : (
                          <span class="text-medium-emphasis">—</span>
                        ),
                      'item.invoices': ({ item }: any) => renderInvoices(item),
                      'item.actions': ({ item }: any) =>
                        canEdit.value ? (
                          <v-btn
                            icon="mdi-delete"
                            variant="text"
                            size="small"
                            color="error"
                            title="Видалити позицію"
                            onClick={() => openDeleteMaterial(item)}
                          />
                        ) : null,
                    }}
                  </v-data-table>
                  <v-divider />
                  <v-card-text class="d-flex justify-end py-3">
                    <div class="text-h6">
                      <span class="text-medium-emphasis text-body-1">Разом за матеріалами: </span>
                      <span class="font-weight-bold">{uah(totalAmount.value)}</span>
                    </div>
                  </v-card-text>
                </>
              )}
            </v-card>

            <v-card variant="outlined">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" icon="mdi-history" size="small" />
                Історія змін
              </v-card-title>
              <AuditLogPanel entityType="ElectricalInstallationWork" entityId={id} />
            </v-card>

            {/* Add material dialog */}
            <v-dialog v-model={addOpen.value} max-width={620}>
              <v-card>
                <v-card-title>Додати матеріал</v-card-title>
                <v-card-text>
                  {addErr.value && <v-alert type="error" variant="tonal" class="mb-3">{addErr.value}</v-alert>}

                  <v-btn-toggle v-model={mode.value} mandatory divided color="primary" class="mb-4">
                    <v-btn value="stock" disabled={lotOptions.value.length === 0}>Зі складу обʼєкта</v-btn>
                    <v-btn value="custom">Довільна позиція</v-btn>
                  </v-btn-toggle>

                  {mode.value === 'stock' ? (
                    lotOptions.value.length === 0 ? (
                      <v-alert type="info" variant="tonal" density="compact">
                        На обʼєкті немає залишків для списання. Скористайтесь «Довільна позиція» або
                        спершу відпустіть матеріали на обʼєкт.
                      </v-alert>
                    ) : (
                      <>
                        <p class="text-body-2 text-medium-emphasis mb-3">
                          Обрана кількість списується із залишку на обʼєкті (рух «Використано на обʼєкті»).
                        </p>
                        {stockLines.value.map((line, index) => (
                          <div key={index} class="mb-3">
                            <div class="d-flex align-center ga-2">
                              <v-select
                                v-model={line.lotKey}
                                label="Партія (товар · постачальник · ціна) *"
                                items={lotOptions.value}
                                item-title="title"
                                item-value="key"
                                hide-details
                                density="comfortable"
                                class="flex-grow-1"
                                disabled={saving.value}
                              />
                              <v-text-field
                                v-model={line.quantity}
                                label="Кількість *"
                                type="number"
                                min={0.001}
                                step={0.001}
                                suffix={line.lotKey ? unitFor(line.lotKey) : ''}
                                hide-details
                                density="comfortable"
                                style="max-width: 150px"
                                disabled={saving.value || !line.lotKey}
                              />
                              <v-btn
                                icon="mdi-delete"
                                variant="text"
                                size="small"
                                disabled={saving.value || stockLines.value.length <= 1}
                                onClick={() => removeStockLine(index)}
                              />
                            </div>
                            {line.lotKey && (
                              <div class="text-caption text-medium-emphasis mt-1">
                                На обʼєкті: {qtyStr(maxQtyFor(line.lotKey))} {unitFor(line.lotKey)}
                              </div>
                            )}
                          </div>
                        ))}
                        <v-btn
                          size="small"
                          variant="text"
                          prepend-icon="mdi-plus"
                          class="mt-1"
                          disabled={saving.value}
                          onClick={addStockLine}
                        >
                          Додати рядок
                        </v-btn>
                      </>
                    )
                  ) : (
                    <>
                      <v-text-field v-model={customForm.name} label="Назва позиції *" class="mb-2" disabled={saving.value} />
                      <v-row>
                        <v-col cols={6} md={3}>
                          <v-text-field v-model={customForm.unit} label="Одиниця" disabled={saving.value} />
                        </v-col>
                        <v-col cols={6} md={4}>
                          <v-text-field
                            v-model={customForm.quantity}
                            label="Кількість *"
                            type="number"
                            min={0.001}
                            step={0.001}
                            disabled={saving.value}
                          />
                        </v-col>
                        <v-col cols={12} md={5}>
                          <v-text-field
                            v-model={customForm.pricePerUnit}
                            label="Ціна за одиницю, ₴"
                            type="number"
                            min={0}
                            step={0.01}
                            disabled={saving.value}
                          />
                        </v-col>
                      </v-row>
                      <v-text-field v-model={customForm.note} label="Примітка" disabled={saving.value} />
                      <p class="text-caption text-medium-emphasis mt-1">
                        Довільна позиція не впливає на залишки обʼєкта — лише для документації.
                      </p>
                    </>
                  )}
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                  <v-spacer />
                  <v-btn variant="outlined" disabled={saving.value} onClick={() => (addOpen.value = false)}>
                    Скасувати
                  </v-btn>
                  <v-btn color="primary" variant="elevated" loading={saving.value} onClick={submitAdd}>
                    Додати
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>

            {/* Delete material dialog */}
            <v-dialog v-model={delOpen.value} max-width={440}>
              <v-card>
                <v-card-title>Видалити позицію?</v-card-title>
                <v-card-text>
                  Позицію "{delItem.value?.name}" буде видалено.
                  {delItem.value?.writtenOff && ' Кількість повернеться на залишок обʼєкта.'}
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                  <v-spacer />
                  <v-btn variant="outlined" onClick={() => (delOpen.value = false)}>Скасувати</v-btn>
                  <v-btn color="error" variant="elevated" onClick={confirmDeleteMaterial}>Видалити</v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </>
        )}
      </div>
    )
  },
})
