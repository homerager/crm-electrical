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
 */
export async function createNotification(
  input: CreateNotificationInput,
  tx?: Prisma.TransactionClient,
) {
  const db = (tx ?? prisma) as PrismaClient
  try {
    await db.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    })
  } catch (e) {
    console.error('[Notification] Failed to create:', e)
  }
}

/**
 * Creates the same notification for multiple users at once.
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
  } catch (e) {
    console.error('[Notification] Failed to create bulk:', e)
  }
}
