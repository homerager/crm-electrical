import { requirePermission } from '../../../../utils/authz'
import { writeAuditLog } from '../../../../utils/auditLog'
import { addObjectLotQty } from '../../../../utils/stockLots'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'electricalPanels.edit')

  const id = getRouterParam(event, 'id')!
  const materialId = getRouterParam(event, 'materialId')!

  const material = await prisma.electricalPanelMaterial.findUnique({
    where: { id: materialId },
    include: { panel: { select: { id: true, objectId: true } } },
  })
  if (!material || material.panelId !== id) {
    throw createError({ statusCode: 404, statusMessage: 'Позицію не знайдено' })
  }

  await prisma.$transaction(async (tx) => {
    // Reverse the write-off: return the quantity to the object stock lot and drop the movement.
    if (material.writtenOff && material.productId) {
      await addObjectLotQty(
        tx,
        material.panel.objectId,
        material.productId,
        material.contractorId,
        Number(material.pricePerUnit),
        Number(material.vatPercent),
        Number(material.quantity),
      )
    }
    if (material.movementId) {
      await tx.movement.deleteMany({ where: { id: material.movementId } })
    }
    await tx.electricalPanelMaterial.delete({ where: { id: materialId } })
  })

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'UPDATE',
    entityType: 'ElectricalPanel',
    entityId: id,
    changes: { removedMaterial: material.name, returnedToStock: material.writtenOff },
  })

  return { ok: true }
})
