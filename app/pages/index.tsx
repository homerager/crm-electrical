export default defineComponent({
  name: 'DashboardPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({
      title: "Дашбоард"
    })


    const { data: stockData } = useFetch('/api/reports/stock')
    const { data: invoicesData } = useFetch('/api/invoices')
    const { data: movementsData } = useFetch('/api/movements')
    const { data: objectsData } = useFetch('/api/objects')
    const { data: warehousesData } = useFetch('/api/warehouses')
    const { data: productsData } = useFetch('/api/products')

    const totalWarehouses = computed(() => (warehousesData.value as any)?.warehouses?.length ?? 0)
    const totalProducts = computed(() => (productsData.value as any)?.products?.length ?? 0)
    const totalObjects = computed(() => (objectsData.value as any)?.objects?.length ?? 0)
    const activeObjects = computed(
      () => (objectsData.value as any)?.objects?.filter((o: any) => o.status === 'ACTIVE').length ?? 0,
    )
    const totalInvoices = computed(() => (invoicesData.value as any)?.invoices?.length ?? 0)
    const totalMovements = computed(() => (movementsData.value as any)?.movements?.length ?? 0)

    const recentInvoices = computed(() =>
      ((invoicesData.value as any)?.invoices ?? []).slice(0, 5),
    )
    const recentMovements = computed(() =>
      ((movementsData.value as any)?.movements ?? []).slice(0, 5),
    )

    const statCards = computed(() => [
      { title: 'Склади', value: totalWarehouses.value, icon: 'mdi-warehouse', color: 'primary', to: '/warehouses' },
      { title: 'Товари', value: totalProducts.value, icon: 'mdi-package-variant-closed', color: 'success', to: '/products' },
      { title: 'Обʼєкти', value: `${activeObjects.value} / ${totalObjects.value}`, icon: 'mdi-office-building-outline', color: 'warning', to: '/objects', subtitle: 'активних / всього' },
      { title: 'Накладні', value: totalInvoices.value, icon: 'mdi-file-document-multiple', color: 'info', to: '/invoices' },
      { title: 'Переміщення', value: totalMovements.value, icon: 'mdi-swap-horizontal', color: 'secondary', to: '/movements' },
    ])

    return () => (
      <div>
        <div class="text-h5 font-weight-bold mb-6">Дашборд</div>

        <v-row class="mb-4">
          {statCards.value.map((card) => (
            <v-col key={card.title} cols={12} sm={6} md={4} lg={2}>
              <v-card to={card.to} hover>
                <v-card-text class="text-center pa-4">
                  <v-icon size={40} color={card.color} icon={card.icon} class="mb-2" />
                  <div class="text-h5 font-weight-bold">{card.value}</div>
                  <div class="text-body-2 text-medium-emphasis">{card.title}</div>
                  {card.subtitle && <div class="text-caption text-medium-emphasis">{card.subtitle}</div>}
                </v-card-text>
              </v-card>
            </v-col>
          ))}
        </v-row>

        <v-row>
          <v-col cols={12} md={6}>
            <v-card>
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" icon="mdi-file-document-multiple" />
                Останні накладні
                <v-spacer />
                <v-btn variant="text" size="small" to="/invoices">Всі</v-btn>
              </v-card-title>
              <v-list lines="two">
                {recentInvoices.value.length === 0 && (
                  <v-list-item title="Немає накладних" />
                )}
                {recentInvoices.value.map((inv: any) => (
                  <v-list-item
                    key={inv.id}
                    title={`№${inv.number} — ${inv.warehouse?.name}`}
                    subtitle={new Date(inv.date).toLocaleDateString('uk-UA')}
                    to={`/invoices/${inv.id}`}
                  >
                    {{
                      prepend: () => (
                        <v-chip
                          size="small"
                          color={inv.type === 'INCOMING' ? 'success' : 'error'}
                          variant="tonal"
                          class="mr-2"
                        >
                          {inv.type === 'INCOMING' ? 'Прихід' : 'Видаток'}
                        </v-chip>
                      ),
                    }}
                  </v-list-item>
                ))}
              </v-list>
            </v-card>
          </v-col>

          <v-col cols={12} md={6}>
            <v-card>
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" icon="mdi-swap-horizontal" />
                Останні переміщення
                <v-spacer />
                <v-btn variant="text" size="small" to="/movements">Всі</v-btn>
              </v-card-title>
              <v-list lines="two">
                {recentMovements.value.length === 0 && (
                  <v-list-item title="Немає переміщень" />
                )}
                {recentMovements.value.map((mov: any) => (
                  <v-list-item
                    key={mov.id}
                    title={
                      mov.type === 'WAREHOUSE_TO_WAREHOUSE'
                        ? `${mov.fromWarehouse?.name} → ${mov.toWarehouse?.name}`
                        : `${mov.fromWarehouse?.name} → ${mov.object?.name}`
                    }
                    subtitle={new Date(mov.date).toLocaleDateString('uk-UA')}
                    to={`/movements/${mov.id}`}
                  >
                    {{
                      prepend: () => (
                        <v-icon
                          icon={mov.type === 'WAREHOUSE_TO_WAREHOUSE' ? 'mdi-swap-horizontal' : 'mdi-truck-delivery'}
                          color={mov.type === 'WAREHOUSE_TO_WAREHOUSE' ? 'primary' : 'warning'}
                        />
                      ),
                    }}
                  </v-list-item>
                ))}
              </v-list>
            </v-card>
          </v-col>
        </v-row>
      </div>
    )
  },
})
