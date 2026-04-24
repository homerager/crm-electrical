export default defineComponent({
  name: 'AuthLayout',
  setup() {
    const slots = useSlots()

    return () => (
      <v-app>
        <v-main style="background: linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)">
          <v-container fluid class="fill-height">
            <v-row align="center" justify="center" class="fill-height">
              <v-col cols={12} sm={8} md={5} lg={4}>
                <div class="text-center mb-6">
                  <v-icon size={56} color="white" icon="mdi-lightning-bolt-circle" />
                  <div class="text-h5 font-weight-bold text-white mt-2">
                    ПРОГРЕС ЕЛЕКТРИК CRM
                  </div>
                  <div class="text-body-2 text-blue-lighten-3">
                    Облік матеріалів
                  </div>
                </div>
                {slots.default?.()}
              </v-col>
            </v-row>
          </v-container>
        </v-main>
      </v-app>
    )
  },
})
