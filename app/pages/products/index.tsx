export default defineComponent({
  name: 'ProductsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({
      title: 'Товари'
    })

    const { isPrivileged } = useAuth()
    const toast = useToast()
    const search = ref('')
    const filterGroupId = ref<string | null>(null)
    const filterContractorId = ref<string | null>(null)
    const filterInvoiceId = ref<string | null>(null)

    const { data, refresh, pending } = useFetch('/api/products', { query: { search } })
    const allProducts = computed(() => (data.value as any)?.products ?? [])
    const products = computed(() => {
      let all = allProducts.value
      if (filterGroupId.value) {
        all = all.filter((p: any) => p.groupId === filterGroupId.value)
      }
      if (filterContractorId.value) {
        all = all.filter((p: any) =>
          (p.supplyHistory ?? []).some((s: any) => s.contractor?.id === filterContractorId.value),
        )
      }
      if (filterInvoiceId.value) {
        all = all.filter((p: any) =>
          (p.supplyHistory ?? []).some((s: any) => s.invoice?.id === filterInvoiceId.value),
        )
      }
      return all
    })

    const { data: groupsData } = useFetch('/api/product-groups')
    const groups = computed(() => (groupsData.value as any)?.groups ?? [])

    const groupOptions = computed(() => [
      { title: 'Усі групи', value: null },
      ...groups.value.map((g: any) => ({ title: g.name, value: g.id })),
    ])

    const contractorOptions = computed(() => {
      const map = new Map<string, string>()
      for (const p of allProducts.value) {
        for (const s of p.supplyHistory ?? []) {
          if (s.contractor) map.set(s.contractor.id, s.contractor.name)
        }
      }
      return [
        { title: 'Усі постачальники', value: null },
        ...[...map].map(([value, title]) => ({ title, value })),
      ]
    })

    const invoiceOptions = computed(() => {
      const map = new Map<string, any>()
      for (const p of allProducts.value) {
        for (const s of p.supplyHistory ?? []) {
          if (s.invoice) map.set(s.invoice.id, s.invoice)
        }
      }
      return [
        { title: 'Усі накладні', value: null },
        ...[...map.values()].map((inv: any) => ({
          title: `${inv.number} (${new Date(inv.date).toLocaleDateString('uk-UA')})`,
          value: inv.id,
        })),
      ]
    })

    const dialog = ref(false)
    const deleteDialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const editItem = ref<any>(null)
    const deleteItem = ref<any>(null)

    const form = reactive({ name: '', description: '', sku: '', unit: 'шт', groupId: null as string | null })

    const unitOptions = ['шт', 'м', 'м²', 'м³', 'кг', 'т', 'л', 'уп', 'к-т', 'пог.м']

    function generateSku() {
      const raw =
        typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID
          ? globalThis.crypto.randomUUID().replace(/-/g, '')
          : `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`
      form.sku = `P-${raw.slice(0, 8).toUpperCase()}`
    }

    function openCreate() {
      editItem.value = null
      Object.assign(form, { name: '', description: '', sku: '', unit: 'шт', groupId: null })
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
        groupId: item.groupId || null,
      })
      error.value = ''
      dialog.value = true
    }

    function openDelete(item: any) {
      deleteItem.value = item
      deleteDialog.value = true
    }

    async function save() {
      saving.value = true
      error.value = ''
      const isEdit = !!editItem.value
      try {
        if (editItem.value) {
          await $fetch(`/api/products/${editItem.value.id}`, { method: 'PUT', body: form })
        } else {
          await $fetch('/api/products', { method: 'POST', body: form })
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

    async function confirmDelete() {
      if (!deleteItem.value) return
      try {
        await $fetch(`/api/products/${deleteItem.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
        toast.success('Товар видалено')
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка видалення'
        toast.error(error.value)
      }
    }

    const headers = [
      { title: 'Назва', key: 'name' },
      { title: 'Артикул', key: 'sku' },
      { title: 'Одиниця', key: 'unit', width: 100 },
      { title: 'Група', key: 'group', sortable: false },
      { title: 'Опис', key: 'description' },
      { title: 'На складах', key: 'stock', sortable: false },
      { title: 'Постачальники', key: 'supplyHistory', sortable: false },
      { title: 'Накладні', key: 'invoices', sortable: false },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 100 },
    ]

    function totalStock(product: any) {
      return (product.stock ?? []).reduce((sum: number, s: any) => sum + Number(s.quantity), 0)
    }

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Товари</div>
          <v-spacer />
          {isPrivileged.value && (
            <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
              Додати товар
            </v-btn>
          )}
        </div>

        <v-card>
          <v-card-text class="pb-0">
            <v-row>
              <v-col cols={12} sm={6} md={3}>
                <v-text-field
                  v-model={search.value}
                  label="Пошук за назвою або артикулом"
                  prepend-inner-icon="mdi-magnify"
                  clearable
                  hide-details
                />
              </v-col>
              <v-col cols={12} sm={6} md={3}>
                <v-select
                  v-model={filterGroupId.value}
                  label="Фільтр за групою"
                  items={groupOptions.value}
                  item-title="title"
                  item-value="value"
                  clearable
                  hide-details
                />
              </v-col>
              <v-col cols={12} sm={6} md={3}>
                <v-select
                  v-model={filterContractorId.value}
                  label="Фільтр за постачальником"
                  items={contractorOptions.value}
                  item-title="title"
                  item-value="value"
                  prepend-inner-icon="mdi-truck"
                  clearable
                  hide-details
                />
              </v-col>
              <v-col cols={12} sm={6} md={3}>
                <v-select
                  v-model={filterInvoiceId.value}
                  label="Фільтр за накладною"
                  items={invoiceOptions.value}
                  item-title="title"
                  item-value="value"
                  prepend-inner-icon="mdi-file-document"
                  clearable
                  hide-details
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-data-table headers={headers} items={products.value} loading={pending.value} hover>
            {{
              'item.sku': ({ item }: any) => (
                <v-chip size="small" variant="outlined">{item.sku || '—'}</v-chip>
              ),
              'item.group': ({ item }: any) => (
                item.group
                  ? <v-chip size="small" color="secondary" variant="tonal" prepend-icon="mdi-tag">{item.group.name}</v-chip>
                  : <span class="text-medium-emphasis">—</span>
              ),
              'item.stock': ({ item }: any) => {
                const total = totalStock(item)
                return (
                  <div>
                    <v-chip size="small" color={total > 0 ? 'success' : 'error'} variant="tonal">
                      {total.toLocaleString('uk-UA')} {item.unit}
                    </v-chip>
                    {item.stock?.length > 1 && (
                      <v-tooltip>
                        {{
                          activator: ({ props }: any) => (
                            <v-icon {...props} size="small" class="ml-1" icon="mdi-information-outline" />
                          ),
                          default: () => (
                            <div>
                              {item.stock.map((s: any) => (
                                <div key={s.warehouseId}>
                                  {s.warehouse.name}: {Number(s.quantity)} {item.unit}
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

        <v-dialog v-model={dialog.value} max-width={500}>
          <v-card>
            <v-card-title>{editItem.value ? 'Редагувати товар' : 'Новий товар'}</v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-text-field v-model={form.name} label="Назва *" class="mb-3" />
              <v-text-field v-model={form.sku} label="Артикул (SKU)" class="mb-3">
                {{
                  'append-inner': () => (
                    <v-btn
                      type="button"
                      icon="mdi-autorenew"
                      variant="text"
                      size="small"
                      tabindex={-1}
                      aria-label="Згенерувати артикул"
                      onMousedown={(e: MouseEvent) => e.preventDefault()}
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation()
                        generateSku()
                      }}
                    />
                  ),
                }}
              </v-text-field>
              <v-combobox v-model={form.unit} label="Одиниця виміру" items={unitOptions} class="mb-3" />
              <v-select
                v-model={form.groupId}
                label="Група товарів"
                items={groups.value}
                item-title="name"
                item-value="id"
                clearable
                class="mb-3"
                prepend-inner-icon="mdi-tag"
              />
              <v-textarea v-model={form.description} label="Опис" rows={3} />
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (dialog.value = false)}>Скасувати</v-btn>
              <v-btn color="primary" variant="elevated" loading={saving.value} disabled={!form.name} onClick={save}>
                {editItem.value ? 'Зберегти' : 'Створити'}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model={deleteDialog.value} max-width={400}>
          <v-card>
            <v-card-title>Видалити товар?</v-card-title>
            <v-card-text>Товар "{deleteItem.value?.name}" буде видалено.</v-card-text>
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
