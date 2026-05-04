function movementDetailMeta(type: string) {
  switch (type) {
    case 'WAREHOUSE_TO_WAREHOUSE':
      return {
        title: 'Переміщення між складами',
        chip: 'Між складами',
        color: 'primary',
        icon: 'mdi-swap-horizontal' as const,
      }
    case 'WAREHOUSE_TO_OBJECT':
      return {
        title: 'Переміщення на обʼєкт',
        chip: 'На обʼєкт',
        color: 'warning',
        icon: 'mdi-truck-delivery' as const,
      }
    case 'OBJECT_WRITE_OFF':
      return {
        title: 'Списання з обʼєкта',
        chip: 'Списання',
        color: 'error',
        icon: 'mdi-minus-circle-outline' as const,
      }
    case 'OBJECT_TO_WAREHOUSE':
      return {
        title: 'Повернення на склад',
        chip: 'Повернення на склад',
        color: 'success',
        icon: 'mdi-keyboard-return' as const,
      }
    default:
      return { title: 'Переміщення', chip: type, color: 'grey', icon: 'mdi-help' as const }
  }
}

export default defineComponent({
  name: 'MovementDetailPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const id = route.params.id as string
    const { data, pending } = useFetch(`/api/movements/${id}`)
    const movement = computed(() => (data.value as any)?.movement)

    const meta = computed(() =>
      movement.value ? movementDetailMeta(movement.value.type) : movementDetailMeta(''),
    )

    useHead({
      title: computed(() => meta.value.title),
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
              color={meta.value.color}
              variant="tonal"
              prepend-icon={meta.value.icon}
            >
              {meta.value.chip}
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
                  {movement.value.fromWarehouse && (
                    <v-list-item title="Склад відправлення" subtitle={movement.value.fromWarehouse.name} prepend-icon="mdi-warehouse" />
                  )}
                  {movement.value.toWarehouse && movement.value.type === 'WAREHOUSE_TO_WAREHOUSE' && (
                    <v-list-item title="Склад призначення" subtitle={movement.value.toWarehouse.name} prepend-icon="mdi-warehouse" />
                  )}
                  {movement.value.toWarehouse && movement.value.type === 'OBJECT_TO_WAREHOUSE' && (
                    <v-list-item title="Склад повернення" subtitle={movement.value.toWarehouse.name} prepend-icon="mdi-warehouse" />
                  )}
                  {movement.value.object && (
                    <v-list-item title="Обʼєкт" subtitle={movement.value.object.name} prepend-icon="mdi-office-building-outline" />
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
