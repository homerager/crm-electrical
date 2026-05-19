import type { EquipmentStatus } from '@prisma/client'
import { isElevatedRole } from '../../../utils/authz'
import { emptyToNull } from '../../../utils/strings'

const VALID_STATUSES: EquipmentStatus[] = [
  'IN_STOCK',
  'INSTALLED',
  'IN_REPAIR',
  'DECOMMISSIONED',
  'IN_TRANSIT',
]

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID обовʼязковий' })

  const equipment = await prisma.equipment.findUnique({ where: { id } })
  if (!equipment) {
    throw createError({ statusCode: 404, statusMessage: 'Обладнання не знайдено' })
  }

  const body = await readBody(event)
  const { newStatus, reason, photoUrl } = body

  if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
    throw createError({ statusCode: 400, statusMessage: 'Невалідний статус' })
  }

  if (newStatus === equipment.status) {
    throw createError({ statusCode: 400, statusMessage: 'Обладнання вже має цей статус' })
  }

  if ((newStatus === 'DECOMMISSIONED' || newStatus === 'IN_REPAIR') && !reason?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Вкажіть причину для зміни статусу на списання або ремонт' })
  }

  const statusLog = await prisma.$transaction(async (tx) => {
    const log = await tx.equipmentStatusLog.create({
      data: {
        equipmentId: id,
        oldStatus: equipment.status,
        newStatus: newStatus as EquipmentStatus,
        reason: emptyToNull(reason),
        photoUrl: emptyToNull(photoUrl),
        changedById: auth.userId,
      },
      include: {
        changedBy: { select: { id: true, name: true } },
      },
    })

    await tx.equipment.update({
      where: { id },
      data: { status: newStatus as EquipmentStatus },
    })

    return log
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'UPDATE',
    entityType: 'Equipment',
    entityId: id,
    changes: {
      action: 'statusChange',
      oldStatus: equipment.status,
      newStatus,
    },
  })

  return { statusLog }
})
