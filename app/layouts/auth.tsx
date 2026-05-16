export default defineComponent({
  name: 'AuthLayout',
  setup() {
    const slots = useSlots()

    return () => (
      <v-app>
        <v-main
          style={{
            background: 'linear-gradient(140deg, #103F7C 0%, #0B2E5A 60%, #07203F 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Brand green glow — top-left (logo accent) */}
          <div
            style={{
              position: 'absolute',
              top: '-220px',
              left: '-180px',
              width: '560px',
              height: '560px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(86,169,63,0.50) 0%, rgba(86,169,63,0) 70%)',
              pointerEvents: 'none',
            }}
          />
          {/* Brand blue glow — bottom-right */}
          <div
            style={{
              position: 'absolute',
              bottom: '-240px',
              right: '-200px',
              width: '640px',
              height: '640px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(66,165,245,0.42) 0%, rgba(66,165,245,0) 70%)',
              pointerEvents: 'none',
            }}
          />

          <v-container fluid class="fill-height" style={{ position: 'relative', zIndex: 1 }}>
            <v-row align="center" justify="center" class="fill-height">
              <v-col cols={12} sm={8} md={6} lg={4} style={{ maxWidth: '440px' }}>
                <div class="text-center mb-8">
                  <div
                    class="mx-auto mb-4 d-flex align-center justify-center"
                    style={{
                      width: '104px',
                      height: '104px',
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      boxShadow: '0 14px 38px rgba(0,0,0,0.32)',
                    }}
                  >
                    <img
                      src="/static/images/logo.webp"
                      alt="Прогрес Електрик"
                      style={{ width: '70px', height: '70px', objectFit: 'contain' }}
                    />
                  </div>
                  <div
                    class="text-h5 font-weight-bold text-white"
                    style={{ letterSpacing: '0.06em' }}
                  >
                    ПРОГРЕС ЕЛЕКТРИК
                  </div>
                  <div class="text-body-2 mt-1" style={{ color: 'rgba(255,255,255,0.68)' }}>
                    CRM · Облік матеріалів
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
