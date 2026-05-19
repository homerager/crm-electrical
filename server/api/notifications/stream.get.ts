export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })

  const stream = createEventStream(event)
  const clientId = crypto.randomUUID()

  const client: SSEClient = {
    id: clientId,
    userId: auth.userId,
    push(eventName: string, data: unknown) {
      stream.push({ event: eventName, data: JSON.stringify(data) }).catch(() => {})
    },
    close() {
      removeSSEClient(clientId)
      stream.close()
    },
  }

  addSSEClient(client)

  // Keep-alive ping every 30s
  const pingInterval = setInterval(() => {
    stream.push({ event: 'ping', data: '' }).catch(() => {
      clearInterval(pingInterval)
      removeSSEClient(clientId)
    })
  }, 30_000)

  stream.onClosed(() => {
    clearInterval(pingInterval)
    removeSSEClient(clientId)
  })

  // Send initial data after stream is established
  setTimeout(async () => {
    try {
      const count = await prisma.notification.count({
        where: { userId: auth.userId, isRead: false },
      })
      await stream.push({ event: 'unread-count', data: JSON.stringify({ count }) })
      await stream.push({ event: 'connected', data: JSON.stringify({ clientId }) })
    } catch {}
  }, 50)

  return stream.send()
})
