/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope

// Precache assets injected at build time by vite-plugin-pwa
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ---------------------------------------------------------------------------
// Runtime caching (replicates the previous generateSW workbox.runtimeCaching).
// ---------------------------------------------------------------------------
const apiNetworkFirst = (cacheName: string, maxEntries: number, days: number) =>
  new NetworkFirst({
    cacheName,
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries, maxAgeSeconds: 60 * 60 * 24 * days }),
    ],
  })

registerRoute(/^https?:\/\/.*\/api\/photo-reports.*/i, apiNetworkFirst('api-photo-reports', 100, 7))
registerRoute(/^https?:\/\/.*\/api\/tasks.*/i, apiNetworkFirst('api-tasks', 200, 3))
registerRoute(/^https?:\/\/.*\/api\/objects.*/i, apiNetworkFirst('api-objects', 100, 7))
registerRoute(/^https?:\/\/.*\/api\/projects.*/i, apiNetworkFirst('api-projects', 100, 7))

registerRoute(
  /^https?:\/\/.*\/uploads\/.*/i,
  new CacheFirst({
    cacheName: 'uploaded-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
)

// ---------------------------------------------------------------------------
// Update flow — works with registerType: 'prompt' (PwaUpdatePrompt posts this).
// ---------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ---------------------------------------------------------------------------
// Web Push notifications.
// ---------------------------------------------------------------------------
interface PushPayload {
  title?: string
  body?: string | null
  link?: string | null
  tag?: string
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {}
  if (event.data) {
    try {
      payload = event.data.json() as PushPayload
    } catch {
      payload = { title: event.data.text() }
    }
  }

  const title = payload.title || 'CRM Електрик'
  const options: NotificationOptions = {
    body: payload.body ?? undefined,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag,
    data: { link: payload.link ?? '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/'
  const targetUrl = new URL(link, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate?.(targetUrl)
          return client.focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
