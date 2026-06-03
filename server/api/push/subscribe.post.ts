interface SubscribeBody {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const body = await readBody<SubscribeBody>(event)
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const authKey = body?.keys?.auth

  if (!endpoint || !p256dh || !authKey) {
    throw createError({ statusCode: 400, statusMessage: 'Невалідна підписка push' })
  }

  const userAgent = getRequestHeader(event, 'user-agent') ?? null

  // Endpoint is globally unique — upsert re-binds it to the current user/device.
  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: auth.userId,
      endpoint,
      p256dh,
      auth: authKey,
      userAgent,
    },
    update: {
      userId: auth.userId,
      p256dh,
      auth: authKey,
      userAgent,
    },
  })

  return { id: subscription.id, ok: true }
})
