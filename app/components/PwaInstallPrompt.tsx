export default defineComponent({
  name: 'PwaInstallPrompt',
  setup() {
    const { canInstall, isIos, isInstalled, showIosGuide, install } = usePwaInstall()

    const dismissed = ref(false)

    if (import.meta.client) {
      const dismissedUntil = localStorage.getItem('pwa-install-dismissed')
      if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
        dismissed.value = true
      }
    }

    function dismiss() {
      dismissed.value = true
      localStorage.setItem('pwa-install-dismissed', String(Date.now() + 7 * 24 * 60 * 60 * 1000))
    }

    const showBanner = computed(
      () => !isInstalled.value && !dismissed.value && (canInstall.value || isIos.value),
    )

    return () => (
      <>
        {showBanner.value && (
          <v-banner
            icon={isIos.value ? 'mdi-apple' : 'mdi-cellphone-arrow-down'}
            color="primary"
            lines="one"
            stacked={false}
            class="pwa-install-banner"
          >
            {{
              default: () => (
                <span class="text-body-2">
                  Встановіть CRM на пристрій для роботи офлайн на об'єктах
                </span>
              ),
              actions: () => (
                <>
                  <v-btn
                    variant="text"
                    size="small"
                    class="text-none"
                    onClick={dismiss}
                  >
                    Пізніше
                  </v-btn>
                  <v-btn
                    variant="flat"
                    size="small"
                    color="primary"
                    prepend-icon="mdi-download"
                    class="text-none"
                    onClick={install}
                  >
                    Встановити
                  </v-btn>
                </>
              ),
            }}
          </v-banner>
        )}

        {/* iOS instruction dialog */}
        <v-dialog
          modelValue={showIosGuide.value}
          onUpdate:modelValue={(v: boolean) => { showIosGuide.value = v }}
          max-width={400}
        >
          <v-card>
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="primary">mdi-apple</v-icon>
              Встановлення на iPhone
            </v-card-title>
            <v-card-text>
              <div class="text-body-1 mb-4">
                На iOS додаток встановлюється через <strong>Safari</strong>:
              </div>
              <v-list density="compact" class="bg-transparent">
                <v-list-item prepend-icon="mdi-numeric-1-circle-outline">
                  {{
                    default: () => (
                      <span>
                        Відкрийте CRM в <strong>Safari</strong>
                        {' '}(не Chrome)
                      </span>
                    ),
                  }}
                </v-list-item>
                <v-list-item prepend-icon="mdi-numeric-2-circle-outline">
                  {{
                    default: () => (
                      <span>
                        Натисніть
                        <v-icon size="small" class="mx-1">mdi-export-variant</v-icon>
                        <strong>Поділитись</strong> внизу екрану
                      </span>
                    ),
                  }}
                </v-list-item>
                <v-list-item prepend-icon="mdi-numeric-3-circle-outline">
                  {{
                    default: () => (
                      <span>
                        Оберіть <strong>«На Початковий екран»</strong>
                      </span>
                    ),
                  }}
                </v-list-item>
                <v-list-item prepend-icon="mdi-numeric-4-circle-outline">
                  {{
                    default: () => (
                      <span>Натисніть <strong>«Додати»</strong></span>
                    ),
                  }}
                </v-list-item>
              </v-list>
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn
                color="primary"
                variant="flat"
                class="text-none"
                onClick={() => { showIosGuide.value = false }}
              >
                Зрозуміло
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </>
    )
  },
})
