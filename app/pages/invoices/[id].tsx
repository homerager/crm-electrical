export default defineComponent({
  name: 'InvoiceDetailPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const { isAdmin } = useAuth()
    const id = route.params.id as string
    const { data, pending } = useFetch(`/api/invoices/${id}`)
    const invoice = computed(() => (data.value as any)?.invoice)
    const router = useRouter()

    useHead({
      title: computed(() => invoice.value ? `Накладна №${invoice.value.number}` : 'Накладна')
    })

    const deleteDialog = ref(false)
    const deleting = ref(false)

    async function confirmDelete() {
      deleting.value = true
      try {
        await $fetch(`/api/invoices/${id}`, { method: 'DELETE' })
        await router.push('/invoices')
      } finally {
        deleting.value = false
      }
    }

    const itemHeaders = [
      { title: 'Товар', key: 'product.name' },
      { title: 'Артикул', key: 'product.sku', width: 120 },
      { title: 'Кількість', key: 'quantity', align: 'end' as const, width: 120 },
      { title: 'Ціна', key: 'pricePerUnit', align: 'end' as const, width: 120 },
      { title: 'Сума', key: 'total', align: 'end' as const, width: 120 },
    ]

    const totalSum = computed(() =>
      (invoice.value?.items ?? []).reduce(
        (s: number, i: any) => s + Number(i.quantity) * Number(i.pricePerUnit),
        0,
      ),
    )

    return () => (
      <div>
        <div class="d-flex align-center mb-4">
          <v-btn icon="mdi-arrow-left" variant="text" to="/invoices" class="mr-2" />
          {invoice.value && (
            <>
              <div class="text-h5 font-weight-bold">
                Накладна №{invoice.value.number}
              </div>
              <v-chip
                class="ml-3"
                color={invoice.value.type === 'INCOMING' ? 'success' : 'error'}
                variant="tonal"
              >
                {invoice.value.type === 'INCOMING' ? 'Прихід' : 'Видаток'}
              </v-chip>
            </>
          )}
          <v-spacer />
          {isAdmin.value && invoice.value && (
            <v-btn color="error" variant="outlined" prepend-icon="mdi-delete" onClick={() => (deleteDialog.value = true)}>
              Видалити
            </v-btn>
          )}
        </div>

        {pending.value && <v-progress-linear indeterminate color="primary" />}

        {invoice.value && (
          <v-row>
            <v-col cols={12} md={4}>
              <v-card class="mb-4">
                <v-list lines="two">
                  <v-list-item title="Дата" subtitle={new Date(invoice.value.date).toLocaleDateString('uk-UA')} prepend-icon="mdi-calendar" />
                  <v-list-item title="Склад" subtitle={invoice.value.warehouse?.name} prepend-icon="mdi-warehouse" />
                  <v-list-item title="Контрагент" subtitle={invoice.value.contractor?.name || '—'} prepend-icon="mdi-domain" />
                  <v-list-item title="Створив" subtitle={invoice.value.createdBy?.name} prepend-icon="mdi-account" />
                  {invoice.value.notes && (
                    <v-list-item title="Примітки" subtitle={invoice.value.notes} prepend-icon="mdi-note-text" />
                  )}
                </v-list>
              </v-card>
            </v-col>

            <v-col cols={12} md={8}>
              <v-card>
                <v-card-title>Позиції</v-card-title>
                <v-data-table headers={itemHeaders} items={invoice.value.items ?? []} hide-default-footer>
                  {{
                    'item.product.sku': ({ item }: any) => (
                      <span>{item.product?.sku || '—'}</span>
                    ),
                    'item.quantity': ({ item }: any) => (
                      <span>{Number(item.quantity).toLocaleString('uk-UA')} {item.product?.unit}</span>
                    ),
                    'item.pricePerUnit': ({ item }: any) => (
                      <span>₴{Number(item.pricePerUnit).toLocaleString('uk-UA', { minimumFractionDigits: 2 })}</span>
                    ),
                    'item.total': ({ item }: any) => (
                      <strong>₴{(Number(item.quantity) * Number(item.pricePerUnit)).toLocaleString('uk-UA', { minimumFractionDigits: 2 })}</strong>
                    ),
                    'body.append': () => (
                      <tr>
                        <td colspan={4} class="text-right font-weight-bold pa-3">Всього:</td>
                        <td class="text-right font-weight-bold pa-3">₴{totalSum.value.toLocaleString('uk-UA', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ),
                  }}
                </v-data-table>
              </v-card>
            </v-col>
          </v-row>
        )}

        <v-dialog v-model={deleteDialog.value} max-width={400}>
          <v-card>
            <v-card-title>Видалити накладну?</v-card-title>
            <v-card-text>
              Накладну №{invoice.value?.number} буде видалено, залишки на складі будуть перераховані.
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (deleteDialog.value = false)}>Скасувати</v-btn>
              <v-btn color="error" variant="elevated" loading={deleting.value} onClick={confirmDelete}>Видалити</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
