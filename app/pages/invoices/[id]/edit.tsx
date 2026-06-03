import InvoiceEditor from '../../../components/InvoiceEditor'

export default defineComponent({
  name: 'InvoiceEditPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const id = route.params.id as string

    useHead({ title: 'Редагування накладної' })

    return () => (
      <div>
        <div class="page-toolbar">
          <v-btn icon="mdi-arrow-left" variant="text" to={`/invoices/${id}`} class="mr-2" />
          <div class="text-h5 font-weight-bold">Редагування накладної</div>
        </div>
        <InvoiceEditor invoiceId={id} />
      </div>
    )
  },
})
