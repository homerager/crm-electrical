import MovementEditor from '../../components/MovementEditor'
import AuditLogPanel from '../../components/AuditLogPanel'

export default defineComponent({
  name: 'WarehouseDetailPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const id = route.params.id as string
    const toast = useToast()

    const { data, pending, refresh: refreshWarehouse } = useFetch(`/api/warehouses/${id}`)
    const warehouse = computed(() => (data.value as any)?.warehouse)

    useHead({
      title: computed(() => warehouse.value ? `Склад: ${warehouse.value.name}` : 'Склад')
    })

    const tab = ref('stock')
    const directionFilter = ref<'in' | 'out' | null>(null)

    const { data: movData, pending: movPending, refresh: refreshMovements } = useFetch(
      `/api/warehouses/${id}/movements`,
      { query: computed(() => directionFilter.value ? { direction: directionFilter.value } : {}) },
    )
    const movements = computed(() => (movData.value as any)?.movements ?? [])

    const expandedRows = ref<string[]>([])
    
    function toggleExpand(movId: string) {
      const idx = expandedRows.value.indexOf(movId)
      if (idx === -1) expandedRows.value.push(movId)
      else expandedRows.value.splice(idx, 1)
    }

    const stockHeaders = [
      { title: 'Товар', key: 'product.name' },
      { title: 'Артикул', key: 'product.sku' },
      { title: 'Кількість', key: 'quantity', align: 'end' as const },
      { title: 'Одиниця', key: 'product.unit', align: 'end' as const },
      { title: 'Мін. залишок', key: 'minStock', align: 'end' as const, width: 130 },
      { title: 'Постачальники', key: 'supplyHistory', sortable: false },
      { title: 'Накладні', key: 'invoices', sortable: false },
      { title: '', key: 'actions', sortable: false, align: 'end' as const, width: 96 },
    ]

    // ── Мінімальний залишок ─────────────────────────────────────
    const minStockDialog = ref(false)
    const minStockSaving = ref(false)
    const minStockError = ref('')
    const minStockTarget = ref<any>(null)
    const minStockValue = ref<string>('')

    function openMinStockEditor(item: any) {
      minStockTarget.value = item
      minStockValue.value = item.minStock != null ? String(Number(item.minStock)) : ''
      minStockError.value = ''
      minStockDialog.value = true
    }

    async function saveMinStock() {
      if (!minStockTarget.value) return
      minStockSaving.value = true
      minStockError.value = ''
      try {
        const raw = minStockValue.value.trim().replace(',', '.')
        const parsed = raw === '' ? null : Number(raw)
        if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
          minStockError.value = 'Введіть невідʼємне число або залиште поле порожнім'
          minStockSaving.value = false
          return
        }
        await $fetch(`/api/warehouses/${id}/min-stock`, {
          method: 'PUT',
          body: { productId: minStockTarget.value.productId, minStock: parsed },
        })
        minStockDialog.value = false
        await refreshWarehouse()
        toast.success(parsed == null ? 'Мінімум знято' : 'Мінімум збережено')
      } catch (e: any) {
        minStockError.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        minStockSaving.value = false
      }
    }

    function isBelowMin(item: any) {
      return item.minStock != null && Number(item.quantity) < Number(item.minStock)
    }

    const movHeaders = [
      { title: '', key: 'expand', sortable: false, width: 48 },
      { title: 'Напрямок', key: 'direction', sortable: false, width: 150 },
      { title: 'Дата', key: 'date', width: 120 },
      { title: 'Звідки', key: 'from', sortable: false },
      { title: 'Куди', key: 'to', sortable: false },
      { title: 'Позицій', key: 'items', sortable: false, width: 90, align: 'center' as const },
      { title: 'Автор', key: 'author', sortable: false, width: 160 },
      { title: '', key: 'link', sortable: false, width: 60 },
    ]

    function isIncoming(mov: any) {
      return mov.toWarehouseId === id
    }

    const directionOptions = [
      { title: 'Всі', value: null },
      { title: 'Надходження', value: 'in' },
      { title: 'Відправлення', value: 'out' },
    ]

    const transferOpen = ref(false)
    const transferKey = ref(0)
    const transferPrefill = ref<{ productId?: string; qty?: number } | null>(null)

    function openTransfer(params?: { productId: string; qty: number }) {
      transferPrefill.value = params ? { productId: params.productId, qty: params.qty } : null
      transferKey.value += 1
      transferOpen.value = true
    }

    async function onTransferSuccess(_movementId: string) {
      transferOpen.value = false
      await Promise.all([refreshWarehouse(), refreshMovements()])
      tab.value = 'movements'
    }

    return () => (
      <div>
        <div class="page-toolbar ga-2">
          <v-btn icon="mdi-arrow-left" variant="text" to="/warehouses" class="mr-2" />
          <div class="text-h5 font-weight-bold">{warehouse.value?.name ?? '...'}</div>
          <v-spacer />
          {warehouse.value && (
            <>
              <v-btn
                color="primary"
                variant="flat"
                prepend-icon="mdi-swap-horizontal"
                onClick={() => openTransfer()}
              >
                Нове переміщення
              </v-btn>
              <v-chip color={warehouse.value.isActive ? 'success' : 'default'} variant="tonal">
                {warehouse.value.isActive ? 'Активний' : 'Неактивний'}
              </v-chip>
            </>
          )}
        </div>

        {warehouse.value?.address && (
          <v-alert icon="mdi-map-marker" variant="tonal" color="info" class="mb-4">
            {warehouse.value.address}
          </v-alert>
        )}

        {warehouse.value?.description && (
          <p class="text-body-1 mb-4">{warehouse.value.description}</p>
        )}

        <v-tabs v-model={tab.value} class="mb-4" show-arrows>
          <v-tab value="stock" prepend-icon="mdi-package-variant-closed">Залишки</v-tab>
          <v-tab value="movements" prepend-icon="mdi-swap-horizontal">Переміщення</v-tab>
          <v-tab value="history" prepend-icon="mdi-history">Історія змін</v-tab>
        </v-tabs>

        {tab.value === 'stock' && (
          <v-card>
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" icon="mdi-package-variant-closed" />
              Залишки на складі
            </v-card-title>
            <v-data-table
              headers={stockHeaders}
              items={warehouse.value?.stock ?? []}
              loading={pending.value}
              hover
            >
              {{
                'item.quantity': ({ item }: any) => (
                  <span class={isBelowMin(item) ? 'text-error font-weight-bold' : ''}>
                    {Number(item.quantity).toLocaleString('uk-UA')}
                    {isBelowMin(item) && (
                      <v-tooltip text="Кількість нижче мінімального залишку">
                        {{
                          activator: ({ props }: any) => (
                            <v-icon {...props} size="x-small" icon="mdi-alert" color="error" class="ml-1" />
                          ),
                        }}
                      </v-tooltip>
                    )}
                  </span>
                ),
                'item.minStock': ({ item }: any) => (
                  item.minStock != null
                    ? (
                      <span class={isBelowMin(item) ? 'text-error font-weight-medium' : ''}>
                        {Number(item.minStock).toLocaleString('uk-UA')}
                      </span>
                    )
                    : <span class="text-medium-emphasis">—</span>
                ),
                'item.supplyHistory': ({ item }: any) => {
                  const contractors = [
                    ...new Map(
                      (item.supplyHistory ?? [])
                        .filter((s: any) => s.contractor)
                        .map((s: any) => [s.contractor.id, s.contractor.name]),
                    ).values(),
                  ] as string[]
                  if (!contractors.length) return <span class="text-medium-emphasis">—</span>
                  const visible = contractors.slice(0, 2)
                  const rest = contractors.slice(2)
                  return (
                    <div class="d-flex flex-wrap gap-1 align-center">
                      {visible.map((name, i) => (
                        <v-chip key={i} size="x-small" variant="tonal" color="secondary">{name}</v-chip>
                      ))}
                      {rest.length > 0 && (
                        <v-tooltip>
                          {{
                            activator: ({ props }: any) => (
                              <v-chip {...props} size="x-small" variant="tonal">+{rest.length}</v-chip>
                            ),
                            default: () => (
                              <div>{rest.map((name, i) => <div key={i}>{name}</div>)}</div>
                            ),
                          }}
                        </v-tooltip>
                      )}
                    </div>
                  )
                },
                'item.invoices': ({ item }: any) => {
                  const invoices = [
                    ...new Map(
                      (item.supplyHistory ?? []).map((s: any) => [s.invoice.id, s.invoice]),
                    ).values(),
                  ] as any[]
                  if (!invoices.length) return <span class="text-medium-emphasis">—</span>
                  const visible = invoices.slice(0, 2)
                  const rest = invoices.slice(2)
                  return (
                    <div class="d-flex flex-wrap gap-1 align-center">
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
                },
                'item.actions': ({ item }: any) => (
                  <div class="d-flex justify-end">
                    <v-tooltip text="Задати мінімальний залишок" location="start">
                      {{
                        activator: ({ props }: any) => (
                          <v-btn
                            {...props}
                            icon={item.minStock != null ? 'mdi-bell-ring-outline' : 'mdi-bell-outline'}
                            variant="text"
                            size="small"
                            color={item.minStock != null ? 'warning' : undefined}
                            onClick={() => openMinStockEditor(item)}
                          />
                        ),
                      }}
                    </v-tooltip>
                    <v-tooltip text="Перемістити цей товар" location="start">
                      {{
                        activator: ({ props }: any) => (
                          <v-btn
                            {...props}
                            icon="mdi-swap-horizontal"
                            variant="text"
                            size="small"
                            color="primary"
                            disabled={Number(item.quantity) <= 0}
                            onClick={() =>
                              openTransfer({ productId: item.productId, qty: Number(item.quantity) })
                            }
                          />
                        ),
                      }}
                    </v-tooltip>
                  </div>
                ),
              }}
            </v-data-table>
          </v-card>
        )}

        {tab.value === 'movements' && (
          <v-card>
            <v-card-text class="pb-0 d-flex flex-wrap align-center ga-2">
              <v-btn-toggle
                v-model={directionFilter.value}
                rounded="lg"
                density="compact"
                class="mb-2"
              >
                {directionOptions.map((opt) => (
                  <v-btn key={String(opt.value)} value={opt.value}>
                    {opt.title}
                  </v-btn>
                ))}
              </v-btn-toggle>
              <v-spacer />
              {warehouse.value && (
                <v-btn
                  color="primary"
                  variant="flat"
                  prepend-icon="mdi-plus"
                  class="mb-2"
                  onClick={() => openTransfer()}
                >
                  Створити переміщення
                </v-btn>
              )}
            </v-card-text>

            <v-data-table
              headers={movHeaders}
              items={movements.value}
              loading={movPending.value}
              hover
              item-value="id"
              expanded={expandedRows.value}
              onUpdate:expanded={(val: string[]) => { expandedRows.value = val }}
            >
              {{
                'item.expand': ({ item }: any) => (
                  <v-btn
                    icon={expandedRows.value.includes(item.id) ? 'mdi-chevron-up' : 'mdi-chevron-down'}
                    variant="text"
                    size="small"
                    onClick={() => toggleExpand(item.id)}
                  />
                ),
                'item.direction': ({ item }: any) => {
                  const incoming = isIncoming(item)
                  return (
                    <v-chip
                      size="small"
                      color={incoming ? 'success' : 'warning'}
                      variant="tonal"
                      prepend-icon={incoming ? 'mdi-arrow-down-circle' : 'mdi-arrow-up-circle'}
                    >
                      {incoming ? 'Надходження' : 'Відправлення'}
                    </v-chip>
                  )
                },
                'item.date': ({ item }: any) => (
                  <span>{new Date(item.date).toLocaleDateString('uk-UA')}</span>
                ),
                'item.from': ({ item }: any) => (
                  <span>{item.fromWarehouse?.name ?? '—'}</span>
                ),
                'item.to': ({ item }: any) => (
                  <span>
                    {item.type === 'WAREHOUSE_TO_WAREHOUSE'
                      ? item.toWarehouse?.name
                      : item.object?.name ?? '—'}
                  </span>
                ),
                'item.items': ({ item }: any) => (
                  <v-chip size="small" variant="outlined">{item.items?.length ?? 0}</v-chip>
                ),
                'item.author': ({ item }: any) => (
                  <div class="d-flex align-center gap-1">
                    <v-icon size="small" icon="mdi-account" class="text-medium-emphasis" />
                    <span>{item.createdBy?.name}</span>
                  </div>
                ),
                'item.link': ({ item }: any) => (
                  <v-btn
                    icon="mdi-eye"
                    variant="text"
                    size="small"
                    color="primary"
                    to={`/movements/${item.id}`}
                  />
                ),
                'expanded-row': ({ item }: any) =>
                  expandedRows.value.includes(item.id) ? (
                    <tr>
                      <td colspan={8} class="pa-0">
                        <v-table density="compact" class="bg-surface-variant">
                          <thead>
                            <tr>
                              <th class="text-left pl-10">Товар</th>
                              <th class="text-left">Артикул</th>
                              <th class="text-right">Кількість</th>
                              <th class="text-left">Одиниця</th>
                              <th class="text-left">Постачальники</th>
                              <th class="text-left">Накладні</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.items.map((line: any) => {
                              const cList = [
                                ...new Map(
                                  (line.supplyHistory ?? [])
                                    .filter((s: any) => s.contractor)
                                    .map((s: any) => [s.contractor.id, s.contractor.name]),
                                ).values(),
                              ] as string[]
                              const iList = [
                                ...new Map(
                                  (line.supplyHistory ?? []).map((s: any) => [s.invoice.id, s.invoice]),
                                ).values(),
                              ] as any[]
                              const visC = cList.slice(0, 2)
                              const restC = cList.slice(2)
                              const visI = iList.slice(0, 2)
                              const restI = iList.slice(2)
                              return (
                                <tr key={line.id}>
                                  <td class="pl-10">{line.product.name}</td>
                                  <td>
                                    <v-chip size="x-small" variant="outlined">
                                      {line.product.sku || '—'}
                                    </v-chip>
                                  </td>
                                  <td class="text-right font-weight-medium">
                                    {Number(line.quantity).toLocaleString('uk-UA')}
                                  </td>
                                  <td class="text-medium-emphasis">{line.product.unit}</td>
                                  <td>
                                    {visC.length > 0 ? (
                                      <div class="d-flex flex-wrap gap-1 align-center">
                                        {visC.map((name, i) => (
                                          <v-chip key={i} size="x-small" variant="tonal" color="secondary">{name}</v-chip>
                                        ))}
                                        {restC.length > 0 && (
                                          <v-tooltip>
                                            {{
                                              activator: ({ props }: any) => (
                                                <v-chip {...props} size="x-small" variant="tonal">+{restC.length}</v-chip>
                                              ),
                                              default: () => (
                                                <div>{restC.map((name, i) => <div key={i}>{name}</div>)}</div>
                                              ),
                                            }}
                                          </v-tooltip>
                                        )}
                                      </div>
                                    ) : <span class="text-medium-emphasis">—</span>}
                                  </td>
                                  <td>
                                    {visI.length > 0 ? (
                                      <div class="d-flex flex-wrap gap-1 align-center">
                                        {visI.map((inv: any) => (
                                          <v-chip key={inv.id} size="x-small" variant="outlined" to={`/invoices/${inv.id}`}>
                                            {inv.number} ({new Date(inv.date).toLocaleDateString('uk-UA')})
                                          </v-chip>
                                        ))}
                                        {restI.length > 0 && (
                                          <v-tooltip>
                                            {{
                                              activator: ({ props }: any) => (
                                                <v-chip {...props} size="x-small" variant="tonal">+{restI.length}</v-chip>
                                              ),
                                              default: () => (
                                                <div>
                                                  {restI.map((inv: any) => (
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
                                    ) : <span class="text-medium-emphasis">—</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </v-table>
                      </td>
                    </tr>
                  ) : null,
              }}
            </v-data-table>
          </v-card>
        )}

        {tab.value === 'history' && (
          <v-card>
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" icon="mdi-history" />
              Історія змін
            </v-card-title>
            <AuditLogPanel entityType="Warehouse" entityId={id} />
          </v-card>
        )}

        <v-dialog v-model={minStockDialog.value} max-width={460}>
          <v-card>
            <v-card-title class="pa-4 d-flex align-center" style="gap:8px">
              <v-icon color="warning" icon="mdi-bell-ring-outline" />
              Мінімальний залишок
            </v-card-title>
            <v-card-text class="pa-4 pt-0">
              <div class="text-body-2 text-medium-emphasis mb-3">
                Товар: <span class="font-weight-medium">{minStockTarget.value?.product?.name}</span>
                {minStockTarget.value?.product?.sku ? ` (${minStockTarget.value.product.sku})` : ''}
              </div>
              <div class="text-body-2 text-medium-emphasis mb-4">
                Поточний залишок:{' '}
                <span class="font-weight-medium">
                  {Number(minStockTarget.value?.quantity ?? 0).toLocaleString('uk-UA')}{' '}
                  {minStockTarget.value?.product?.unit}
                </span>
              </div>
              {minStockError.value && (
                <v-alert type="error" variant="tonal" density="compact" class="mb-3">
                  {minStockError.value}
                </v-alert>
              )}
              <v-text-field
                v-model={minStockValue.value}
                label="Мінімальний залишок"
                type="text"
                inputmode="decimal"
                placeholder="напр. 10"
                prepend-inner-icon="mdi-alert-decagram-outline"
                hint="Залиште порожнім, щоб зняти контроль мінімуму"
                persistent-hint
                onKeydown={(e: KeyboardEvent) => e.key === 'Enter' && saveMinStock()}
              />
              <v-alert type="info" variant="tonal" density="compact" class="mt-3" icon="mdi-information-outline">
                Коли кількість опуститься нижче мінімуму — підписані користувачі отримають in-app та Telegram сповіщення.
              </v-alert>
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" disabled={minStockSaving.value} onClick={() => (minStockDialog.value = false)}>
                Скасувати
              </v-btn>
              <v-btn color="primary" variant="elevated" loading={minStockSaving.value} onClick={saveMinStock}>
                Зберегти
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog
          modelValue={transferOpen.value}
          onUpdate:modelValue={(v) => (transferOpen.value = v)}
          max-width={960}
          scrollable
        >
          {transferOpen.value && (
            <v-card>
              <v-card-title class="d-flex align-center">
                Нове переміщення
                <v-spacer />
                <v-btn icon="mdi-close" variant="text" onClick={() => (transferOpen.value = false)} />
              </v-card-title>
              <v-card-text class="pt-2">
                <MovementEditor
                  key={transferKey.value}
                  layout="dialog"
                  fixedFromWarehouseId={id}
                  lockFromWarehouse
                  initialProductId={transferPrefill.value?.productId ?? ''}
                  initialQty={transferPrefill.value?.qty}
                  onSuccess={onTransferSuccess}
                  onCancel={() => (transferOpen.value = false)}
                />
              </v-card-text>
            </v-card>
          )}
        </v-dialog>
      </div>
    )
  },
})
