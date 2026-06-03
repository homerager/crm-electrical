import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  future: { compatibilityVersion: 4 },
  compatibilityDate: '2024-11-01',

  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover',
      meta: [
        { name: 'robots', content: 'noindex' },
        { name: 'theme-color', content: '#1E1E2E' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
      link: [
        { rel: 'apple-touch-icon', href: '/pwa-192x192.png' },
      ],
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
    '@vite-pwa/nuxt',
  ],

  pwa: {
    registerType: 'prompt',
    strategies: 'injectManifest',
    srcDir: 'service-worker',
    filename: 'sw.ts',
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    },
    manifest: {
      name: 'CRM Електрик',
      short_name: 'CRM',
      description: 'CRM для електромонтажних робіт — робота на об\'єктах offline',
      theme_color: '#1E1E2E',
      background_color: '#121212',
      display: 'standalone',
      orientation: 'any',
      start_url: '/',
      scope: '/',
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: true,
      type: 'module',
    },
  },

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
    mailgunApiKey: process.env.MAILGUN_API_KEY || '',
    mailgunDomain: process.env.MAILGUN_DOMAIN || '',
    mailgunFrom: process.env.MAILGUN_FROM || '',
    mailgunUrl: process.env.MAILGUN_URL || 'https://api.eu.mailgun.net',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@proelectric.com.ua',
    public: {
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    },
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
