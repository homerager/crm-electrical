import type { Prisma, PrismaClient } from '@prisma/client'

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'

export type AuditEntityType =
  | 'Warehouse'
  | 'ConstructionObject'
  | 'Product'
  | 'ProductGroup'
  | 'Contractor'
  | 'Invoice'
  | 'Movement'
  | 'Task'
  | 'Project'
  | 'TimeLog'
  | 'User'

interface AuditLogInput {
  userId?: string | null
  userName?: string | null
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  changes?: Record<string, unknown> | null
}

/**
 * Fire-and-forget audit log writer.
 * Accepts either a Prisma transaction client or falls back to the global prisma instance.
 */
export async function writeAuditLog(
  input: AuditLogInput,
  tx?: Prisma.TransactionClient,
) {
  const db = (tx ?? prisma) as PrismaClient
  try {
    await db.auditLog.create({
      data: {
        userId: input.userId ?? null,
        userName: input.userName ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        changes: (input.changes ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
  } catch (e) {
    console.error('[AuditLog] Failed to write:', e)
  }
}

/**
 * Computes a diff between old and new objects, returning only changed fields.
 * Skips internal fields like updatedAt, passwordHash.
 */
export function computeChanges(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  skipFields: string[] = ['updatedAt', 'createdAt', 'passwordHash'],
): Record<string, { old: unknown; new: unknown }> | null {
  const diff: Record<string, { old: unknown; new: unknown }> = {}

  for (const key of Object.keys(newObj)) {
    if (skipFields.includes(key)) continue
    const oldVal = oldObj[key]
    const newVal = newObj[key]

    if (oldVal instanceof Date && newVal instanceof Date) {
      if (oldVal.getTime() !== newVal.getTime()) {
        diff[key] = { old: oldVal.toISOString(), new: newVal.toISOString() }
      }
      continue
    }

    const oldStr = JSON.stringify(oldVal ?? null)
    const newStr = JSON.stringify(newVal ?? null)
    if (oldStr !== newStr) {
      diff[key] = { old: oldVal ?? null, new: newVal ?? null }
    }
  }

  return Object.keys(diff).length > 0 ? diff : null
}
