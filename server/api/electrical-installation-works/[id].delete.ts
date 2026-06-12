import { requirePermission } from '../../utils/authz'
import { writeAuditLog } from '../../utils/auditLog'
import { addObjectLotQty } from '../../utils/stockLots'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'electricalInstallationWorks.delete')

  const id = getRouterParam(event, 'id')!

  const work = await prisma.electricalInstallationWork.findUnique({
    where: { id },
    include: { materials: true },
  })
  if (!work) throw createError({ statusCode: 404, statusMessage: 'Роботу не знайдено' })

  await prisma.$transaction(async (tx) => {
    // Return every written-off material back onto the object stock and drop its write-off movement,
    // so deleting a work never silently loses material from the object's balance.
    for (const m of work.materials) {
      if (m.writtenOff && m.productId) {
        await addObjectLotQty(
          tx,
          work.objectId,
          m.productId,
          m.contractorId,
          Number(m.pricePerUnit),
          Number(m.vatPercent),
          Number(m.quantity),
        )
      }
      if (m.movementId) {
        await tx.movement.deleteMany({ where: { id: m.movementId } })
      }
    }
    await tx.electricalInstallationWork.delete({ where: { id } })
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'DELETE',
    entityType: 'ElectricalInstallationWork',
    entityId: id,
    changes: { type: work.type, name: work.name, materialCount: work.materials.length },
  })

  return { ok: true }
})
