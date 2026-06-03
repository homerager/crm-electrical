interface UnsubscribeBody {
  endpoint?: string
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const body = await readBody<UnsubscribeBody>(event)
  const endpoint = body?.endpoint
  if (!endpoint) {
    throw createError({ statusCode: 400, statusMessage: 'Не вказано endpoint підписки' })
  }

  // Only delete subscriptions that belong to the current user.
  const { count } = await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: auth.userId },
  })

  return { ok: true, removed: count }
})
