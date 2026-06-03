import webpush from 'web-push'

let vapidConfigured = false
let vapidAvailable = false

/** Lazily configures web-push with VAPID details. Returns false if keys are missing. */
function ensureVapid(): boolean {
  if (vapidConfigured) return vapidAvailable

  vapidConfigured = true
  const config = useRuntimeConfig()
  const publicKey = config.vapidPublicKey
  const privateKey = config.vapidPrivateKey
  const subject = config.vapidSubject || 'mailto:admin@example.com'

  if (!publicKey || !privateKey) {
    console.warn('[WebPush] VAPID keys not configured — push notifications disabled')
    vapidAvailable = false
    return false
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    vapidAvailable = true
  } catch (e) {
    console.error('[WebPush] Failed to configure VAPID:', e)
    vapidAvailable = false
  }
  return vapidAvailable
}

export interface WebPushPayload {
  title: string
  body?: string | null
  link?: string | null
  tag?: string
}

/**
 * Sends a web-push notification to every registered device of a user.
 * Fire-and-forget: errors are logged, never thrown. Stale subscriptions
 * (HTTP 404/410) are removed from the database automatically.
 */
export async function sendWebPush(userId: string, payload: WebPushPayload): Promise<void> {
  if (!ensureVapid()) return

  try {
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
    if (!subscriptions.length) return

    const data = JSON.stringify({
      title: payload.title,
      body: payload.body ?? null,
      link: payload.link ?? '/',
      tag: payload.tag,
    })

    const staleIds: string[] = []

    type StoredSubscription = { id: string; endpoint: string; p256dh: string; auth: string }

    await Promise.all(
      subscriptions.map(async (sub: StoredSubscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            data,
          )
        } catch (e: any) {
          const statusCode = e?.statusCode
          if (statusCode === 404 || statusCode === 410) {
            staleIds.push(sub.id)
          } else {
            console.error('[WebPush] Send failed:', statusCode ?? e)
          }
        }
      }),
    )

    if (staleIds.length) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } })
    }
  } catch (e) {
    console.error('[WebPush] Failed to dispatch:', e)
  }
}

/** Sends the same web-push notification to multiple users. */
export async function sendWebPushToMany(userIds: string[], payload: WebPushPayload): Promise<void> {
  if (!userIds.length) return
  await Promise.all(userIds.map((userId) => sendWebPush(userId, payload)))
}
