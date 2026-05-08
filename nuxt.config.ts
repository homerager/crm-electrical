import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  future: { compatibilityVersion: 4 },
  compatibilityDate: '2024-11-01',

  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover',
      meta: [{ name: 'robots', content: 'noindex' }],
    },
  },

  devtools: { enabled: true },

  build: {
    transpile: [
      'vuetify',
      '@fullcalendar/core',
      '@fullcalendar/vue3',
      '@fullcalendar/daygrid',
      '@fullcalendar/timegrid',
      '@fullcalendar/interaction',
      '@fullcalendar/list',
    ],
  },

  modules: [
    (_options, nuxt) => {
      nuxt.hooks.hook('vite:extendConfig', (config) => {
        config.plugins?.push(vuetify({ autoImport: true }))
      })
    },
  ],

  vite: {
    vue: {
      template: {
        transformAssetUrls,
      },
    },
    define: {
      'process.env.DEBUG': false,
    },
  },

  css: ['~/assets/main.css'],

  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
    databaseUrl: process.env.DATABASE_URL || '',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    public: {},
  },

  typescript: {
    strict: true,
    shim: false,
    typeCheck: false,
  },

  nitro: {
    rollupConfig: {
      external: [/\.prisma/],
    },
  },
})
