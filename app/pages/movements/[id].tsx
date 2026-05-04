export default defineComponent({
  name: 'MovementDetailPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const id = route.params.id as string
    const { data, pending } = useFetch(`/api/movements/${id}`)
    const movement = computed(() => (data.value as any)?.movement)

    useHead({
      title: computed(() => {
        if (!movement.value) return 'Переміщення'
        return movement.value.type === 'WAREHOUSE_TO_WAREHOUSE'
          ? 'Переміщення між складами'
          : 'Переміщення на обʼєкт'
      })
    })

    const itemHeaders = [
      { title: 'Товар', key: 'product.name' },
      { title: 'Артикул', key: 'product.sku', width: 120 },
      { title: 'Кількість', key: 'quantity', align: 'end' as const, width: 140 },
    ]

    return () => (
      <div>
        <div class="page-toolbar">
          <v-btn icon="mdi-arrow-left" variant="text" to="/movements" class="mr-2" />
          <div class="text-h5 font-weight-bold">Переміщення</div>
          {movement.value && (
            <v-chip
              class="ml-3"
              color={movement.value.type === 'WAREHOUSE_TO_WAREHOUSE' ? 'primary' : 'warning'}
              variant="tonal"
              prepend-icon={movement.value.type === 'WAREHOUSE_TO_WAREHOUSE' ? 'mdi-swap-horizontal' : 'mdi-truck-delivery'}
            >
              {movement.value.type === 'WAREHOUSE_TO_WAREHOUSE' ? 'Між складами' : 'На обʼєкт'}
            </v-chip>
          )}
        </div>

        {pending.value && <v-progress-linear indeterminate color="primary" />}

        {movement.value && (
          <v-row>
            <v-col cols={12} md={4}>
              <v-card class="mb-4">
                <v-list lines="two">
                  <v-list-item title="Дата" subtitle={new Date(movement.value.date).toLocaleDateString('uk-UA')} prepend-icon="mdi-calendar" />
                  <v-list-item title="Склад відправлення" subtitle={movement.value.fromWarehouse?.name} prepend-icon="mdi-warehouse" />
                  {movement.value.toWarehouse && (
                    <v-list-item title="Склад призначення" subtitle={movement.value.toWarehouse.name} prepend-icon="mdi-warehouse" />
                  )}
                  {movement.value.object && (
                    <v-list-item title="Обʼєкт призначення" subtitle={movement.value.object.name} prepend-icon="mdi-office-building-outline" />
                  )}
                  <v-list-item title="Створив" subtitle={movement.value.createdBy?.name} prepend-icon="mdi-account" />
                  {movement.value.notes && (
                    <v-list-item title="Примітки" subtitle={movement.value.notes} prepend-icon="mdi-note-text" />
                  )}
                </v-list>
              </v-card>
            </v-col>

            <v-col cols={12} md={8}>
              <v-card>
                <v-card-title>Переміщені товари</v-card-title>
                <v-data-table headers={itemHeaders} items={movement.value.items ?? []} hide-default-footer>
                  {{
                    'item.product.sku': ({ item }: any) => (
                      <span>{item.product?.sku || '—'}</span>
                    ),
                    'item.quantity': ({ item }: any) => (
                      <strong>{Number(item.quantity).toLocaleString('uk-UA')} {item.product?.unit}</strong>
                    ),
                  }}
                </v-data-table>
              </v-card>
            </v-col>
          </v-row>
        )}
      </div>
    )
  },
})
