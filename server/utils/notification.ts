import type { PrismaClient, Prisma } from '@prisma/client'

interface CreateNotificationInput {
  userId: string
  title: string
  body?: string | null
  link?: string | null
}

/**
 * Creates an in-app notification for a specific user.
 * Fire-and-forget: errors are logged, never thrown.
 * Pushes real-time SSE event to connected clients.
 */
export async function createNotification(
  input: CreateNotificationInput,
  tx?: Prisma.TransactionClient,
) {
  const db = (tx ?? prisma) as PrismaClient
  try {
    const notification = await db.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    })

    // Push real-time update via SSE
    sendSSEToUser(input.userId, 'notification', {
      id: notification.id,
      userId: notification.userId,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    })

    // Web Push to user's registered devices (fire-and-forget)
    void sendWebPush(input.userId, {
      title: notification.title,
      body: notification.body,
      link: notification.link,
    })
  } catch (e) {
    console.error('[Notification] Failed to create:', e)
  }
}

/**
 * Creates the same notification for multiple users at once.
 * Pushes real-time SSE events to connected clients.
 */
export async function createNotificationForMany(
  userIds: string[],
  data: Omit<CreateNotificationInput, 'userId'>,
  tx?: Prisma.TransactionClient,
) {
  if (!userIds.length) return
  const db = (tx ?? prisma) as PrismaClient
  try {
    await db.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title: data.title,
        body: data.body ?? null,
        link: data.link ?? null,
      })),
    })

    // Push real-time update via SSE to each user
    for (const userId of userIds) {
      sendSSEToUser(userId, 'notification', {
        userId,
        title: data.title,
        body: data.body ?? null,
        link: data.link ?? null,
        isRead: false,
        createdAt: new Date().toISOString(),
      })
    }

    // Web Push to each user's registered devices (fire-and-forget)
    void sendWebPushToMany(userIds, {
      title: data.title,
      body: data.body ?? null,
      link: data.link ?? null,
    })
  } catch (e) {
    console.error('[Notification] Failed to create bulk:', e)
  }
}
