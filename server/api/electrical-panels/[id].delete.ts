import { requirePermission } from '../../utils/authz'
import { writeAuditLog } from '../../utils/auditLog'
import { addObjectLotQty } from '../../utils/stockLots'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'electricalPanels.delete')

  const id = getRouterParam(event, 'id')!

  const panel = await prisma.electricalPanel.findUnique({
    where: { id },
    include: { materials: true },
  })
  if (!panel) throw createError({ statusCode: 404, statusMessage: 'Електрощит не знайдено' })

  await prisma.$transaction(async (tx) => {
    // Return every written-off material back onto the object stock and drop its write-off movement,
    // so deleting a panel never silently loses material from the object's balance.
    for (const m of panel.materials) {
      if (m.writtenOff && m.productId) {
        await addObjectLotQty(
          tx,
          panel.objectId,
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
    await tx.electricalPanel.delete({ where: { id } })
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'DELETE',
    entityType: 'ElectricalPanel',
    entityId: id,
    changes: { name: panel.name, materialCount: panel.materials.length },
  })

  return { ok: true }
})
