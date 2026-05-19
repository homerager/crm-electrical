import { isElevatedRole } from '../../utils/authz'
import { emptyToNull } from '../../utils/strings'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID обовʼязковий' })

  const existing = await prisma.equipment.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Обладнання не знайдено' })
  }

  const body = await readBody(event)
  const { name, model, serialNumber, barcode, status, currentWarehouseId, currentObjectId, responsibleUserId } = body

  const nameTrimmed = typeof name === 'string' ? name.trim() : ''
  if (!nameTrimmed) {
    throw createError({ statusCode: 400, statusMessage: 'Назва обовʼязкова' })
  }

  const barcodeVal = emptyToNull(barcode)
  if (barcodeVal && barcodeVal !== existing.barcode) {
    const duplicate = await prisma.equipment.findUnique({ where: { barcode: barcodeVal } })
    if (duplicate) {
      throw createError({ statusCode: 409, statusMessage: 'Обладнання з таким штрих-кодом вже існує' })
    }
  }

  const equipment = await prisma.equipment.update({
    where: { id },
    data: {
      name: nameTrimmed,
      model: emptyToNull(model),
      serialNumber: emptyToNull(serialNumber),
      barcode: barcodeVal,
      status: status || existing.status,
      currentWarehouseId: emptyToNull(currentWarehouseId),
      currentObjectId: emptyToNull(currentObjectId),
      responsibleUserId: emptyToNull(responsibleUserId),
    },
    include: {
      currentWarehouse: { select: { id: true, name: true } },
      currentObject: { select: { id: true, name: true } },
      responsibleUser: { select: { id: true, name: true } },
    },
  })

  const changes = computeChanges(existing as any, equipment as any)
  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'UPDATE',
    entityType: 'Equipment',
    entityId: equipment.id,
    changes,
  })

  return { equipment }
})
