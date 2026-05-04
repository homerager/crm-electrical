import MovementEditor from '../../components/MovementEditor'

export default defineComponent({
  name: 'MovementCreatePage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({
      title: 'Нове переміщення',
    })

    return () => (
      <div>
        <div class="page-toolbar">
          <v-btn icon="mdi-arrow-left" variant="text" to="/movements" class="mr-2" />
          <div class="text-h5 font-weight-bold">Нове переміщення</div>
        </div>
        <MovementEditor readRouteQuery layout="page" />
      </div>
    )
  },
})
