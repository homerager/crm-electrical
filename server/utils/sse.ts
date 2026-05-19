export interface SSEClient {
  id: string
  userId: string
  push: (event: string, data: unknown) => void
  close: () => void
}

const clients = new Map<string, SSEClient>()

export function getSSEClients(): Map<string, SSEClient> {
  return clients
}

export function addSSEClient(client: SSEClient) {
  clients.set(client.id, client)
}

export function removeSSEClient(id: string) {
  clients.delete(id)
}

export function sendSSEToUser(userId: string, event: string, data: unknown) {
  for (const client of clients.values()) {
    if (client.userId === userId) {
      client.push(event, data)
    }
  }
}

export function sendSSEToUsers(userIds: string[], event: string, data: unknown) {
  for (const client of clients.values()) {
    if (userIds.includes(client.userId)) {
      client.push(event, data)
    }
  }
}

/** Broadcast an event to ALL connected SSE clients. */
export function broadcastSSE(event: string, data: unknown) {
  for (const client of clients.values()) {
    client.push(event, data)
  }
}
