import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { uk } from 'vuetify/locale'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    components,
    directives,
    locale: {
      locale: 'uk',
      messages: { uk },
    },
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          colors: {
            primary: '#1565C0',
            secondary: '#455A64',
            accent: '#FF6F00',
            error: '#D32F2F',
            warning: '#F57C00',
            info: '#0277BD',
            success: '#2E7D32',
            background: '#F5F5F5',
            surface: '#FFFFFF',
          },
        },
        dark: {
          colors: {
            primary: '#42A5F5',
            secondary: '#78909C',
            accent: '#FFB300',
            error: '#EF5350',
            warning: '#FFA726',
            info: '#29B6F6',
            success: '#66BB6A',
          },
        },
      },
    },
    defaults: {
      VBtn: { variant: 'elevated', rounded: 'lg' },
      VCard: { rounded: 'lg', elevation: 2 },
      VTextField: { variant: 'outlined', density: 'comfortable' },
      VSelect: { variant: 'outlined', density: 'comfortable' },
      VTextarea: { variant: 'outlined', density: 'comfortable' },
      VAutocomplete: { variant: 'outlined', density: 'comfortable' },
      VDataTable: { hover: true },
    },
  })

  app.vueApp.use(vuetify)
})
