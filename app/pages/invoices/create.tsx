import InvoiceEditor from '../../components/InvoiceEditor'

export default defineComponent({
  name: 'InvoiceCreatePage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({ title: 'Нова накладна' })

    return () => (
      <div>
        <div class="page-toolbar">
          <v-btn icon="mdi-arrow-left" variant="text" to="/invoices" class="mr-2" />
          <div class="text-h5 font-weight-bold">Нова накладна</div>
        </div>
        <InvoiceEditor />
      </div>
    )
  },
})
