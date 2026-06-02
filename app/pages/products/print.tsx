export default defineComponent({
  name: 'ProductPrintPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Друк етикеток товарів' })

    const { data, pending } = useFetch('/api/products')
    const products = computed(() => (data.value as any)?.products ?? [])

    const selected = ref<string[]>([])
    const search = ref('')
    const labelSize = ref<'small' | 'medium' | 'large'>('medium')

    const filtered = computed(() => {
      if (!search.value) return products.value
      const s = search.value.toLowerCase()
      return products.value.filter((p: any) =>
        p.name.toLowerCase().includes(s)
        || p.sku?.toLowerCase().includes(s)
        || p.barcode?.toLowerCase().includes(s),
      )
    })

    const selectedItems = computed(() =>
      products.value.filter((p: any) => selected.value.includes(p.id)),
    )

    function toggleAll() {
      if (selected.value.length === filtered.value.length) {
        selected.value = []
      } else {
        selected.value = filtered.value.map((p: any) => p.id)
      }
    }

    function toggleItem(id: string) {
      const idx = selected.value.indexOf(id)
      if (idx >= 0) {
        selected.value.splice(idx, 1)
      } else {
        selected.value.push(id)
      }
    }

    const sizeClass = computed(() => {
      switch (labelSize.value) {
        case 'small': return 'qr-label-small'
        case 'large': return 'qr-label-large'
        default: return 'qr-label-medium'
      }
    })

    function printLabels() {
      window.print()
    }

    return () => (
      <div>
        <div class="page-toolbar d-print-none">
          <v-btn icon="mdi-arrow-left" variant="text" to="/products" />
          <div class="text-h5 font-weight-bold ml-2">Друк етикеток товарів</div>
          <v-spacer />
          <v-btn-toggle v-model={labelSize.value} mandatory density="compact" class="mr-3 gap-2">
            <v-btn value="small" size="small">S</v-btn>
            <v-btn value="medium" size="small">M</v-btn>
            <v-btn value="large" size="small">L</v-btn>
          </v-btn-toggle>
          <v-btn
            color="primary"
            prepend-icon="mdi-printer"
            disabled={!selected.value.length}
            onClick={printLabels}
          >
            Друк ({selected.value.length})
          </v-btn>
        </div>

        {/* Selection list */}
        <v-card class="mb-4 d-print-none">
          <v-card-text>
            <v-text-field
              v-model={search.value}
              label="Пошук за назвою, артикулом або штрих-кодом"
              prepend-inner-icon="mdi-magnify"
              clearable
              hide-details
              density="compact"
              class="mb-3"
            />
            <div class="d-flex align-center mb-2">
              <v-checkbox
                model-value={selected.value.length > 0 && selected.value.length === filtered.value.length}
                indeterminate={selected.value.length > 0 && selected.value.length < filtered.value.length}
                label={`Обрати всі (${filtered.value.length})`}
                hide-details
                density="compact"
                onClick={toggleAll}
              />
              <v-spacer />
              <span class="text-body-2 text-medium-emphasis">Обрано: {selected.value.length}</span>
            </div>
            <v-divider class="mb-2" />
            {pending.value ? (
              <div class="d-flex justify-center pa-4">
                <v-progress-circular indeterminate size="32" />
              </div>
            ) : (
              <v-virtual-scroll items={filtered.value} height={400} item-height={48}>
                {{
                  default: ({ item }: any) => (
                    <v-list-item
                      key={item.id}
                      density="compact"
                      onClick={() => toggleItem(item.id)}
                    >
                      {{
                        prepend: () => (
                          <v-checkbox-btn
                            model-value={selected.value.includes(item.id)}
                            onClick={(e: Event) => { e.stopPropagation(); toggleItem(item.id) }}
                          />
                        ),
                        default: () => (
                          <v-list-item-title>{item.name}</v-list-item-title>
                        ),
                        subtitle: () => (
                          <span class="text-caption">{[item.sku, item.barcode].filter(Boolean).join(' • ')}</span>
                        ),
                      }}
                    </v-list-item>
                  ),
                }}
              </v-virtual-scroll>
            )}
          </v-card-text>
        </v-card>

        {/* Print preview / actual print area */}
        {selectedItems.value.length > 0 && (
          <div class={`qr-print-grid ${sizeClass.value}`}>
            {selectedItems.value.map((item: any) => (
              <div key={item.id} class="qr-label">
                <ProductQrCode
                  productId={item.id}
                  size={labelSize.value === 'small' ? 100 : labelSize.value === 'large' ? 200 : 150}
                />
                <div class="qr-label-info">
                  <div class="text-caption font-weight-medium text-truncate">{item.name}</div>
                  {item.barcode && <div class="text-caption text-truncate">{item.barcode}</div>}
                  {!item.barcode && item.sku && <div class="text-caption text-truncate">{item.sku}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Print styles */}
        <style>{`
          @media print {
            .v-navigation-drawer,
            .v-app-bar,
            .d-print-none {
              display: none !important;
            }
            .v-main {
              padding: 0 !important;
            }
            .qr-print-grid {
              display: grid !important;
              gap: 8px;
              padding: 8px;
            }
            .qr-label {
              break-inside: avoid;
              border: 1px dashed #ccc;
              padding: 8px;
              text-align: center;
            }
          }
          .qr-print-grid {
            display: grid;
            gap: 16px;
            padding: 16px;
          }
          .qr-label-small .qr-print-grid,
          .qr-label-small.qr-print-grid {
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          }
          .qr-label-medium .qr-print-grid,
          .qr-label-medium.qr-print-grid {
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          }
          .qr-label-large .qr-print-grid,
          .qr-label-large.qr-print-grid {
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          }
          .qr-label {
            border: 1px dashed rgba(0,0,0,.12);
            border-radius: 8px;
            padding: 12px;
            text-align: center;
          }
          .qr-label-info {
            margin-top: 4px;
          }
        `}</style>
      </div>
    )
  },
})
