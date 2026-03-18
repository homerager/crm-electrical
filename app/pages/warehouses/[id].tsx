export default defineComponent({
  name: 'WarehouseDetailPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const id = route.params.id as string
    const { data, pending } = useFetch(`/api/warehouses/${id}`)
    const warehouse = computed(() => (data.value as any)?.warehouse)

    const stockHeaders = [
      { title: 'Товар', key: 'product.name' },
      { title: 'Артикул', key: 'product.sku' },
      { title: 'Кількість', key: 'quantity', align: 'end' as const },
      { title: 'Одиниця', key: 'product.unit', align: 'end' as const },
    ]

    return () => (
      <div>
        <div class="d-flex align-center mb-4">
          <v-btn icon="mdi-arrow-left" variant="text" to="/warehouses" class="mr-2" />
          <div class="text-h5 font-weight-bold">{warehouse.value?.name ?? '...'}</div>
          <v-spacer />
          {warehouse.value && (
            <v-chip color={warehouse.value.isActive ? 'success' : 'default'} variant="tonal">
              {warehouse.value.isActive ? 'Активний' : 'Неактивний'}
            </v-chip>
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
                <span class={Number(item.quantity) < 5 ? 'text-error font-weight-bold' : ''}>
                  {Number(item.quantity).toLocaleString('uk-UA')}
                </span>
              ),
            }}
          </v-data-table>
        </v-card>
      </div>
    )
  },
})
