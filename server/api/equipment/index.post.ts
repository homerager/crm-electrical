import { isElevatedRole } from '../../utils/authz'
import { emptyToNull } from '../../utils/strings'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const { name, model, serialNumber, barcode, status, currentWarehouseId, currentObjectId, responsibleUserId } = body

  const nameTrimmed = typeof name === 'string' ? name.trim() : ''
  if (!nameTrimmed) {
    throw createError({ statusCode: 400, statusMessage: 'Назва обовʼязкова' })
  }

  if (barcode) {
    const existing = await prisma.equipment.findUnique({ where: { barcode } })
    if (existing) {
      throw createError({ statusCode: 409, statusMessage: 'Обладнання з таким штрих-кодом вже існує' })
    }
  }

  const equipment = await prisma.equipment.create({
    data: {
      name: nameTrimmed,
      model: emptyToNull(model),
      serialNumber: emptyToNull(serialNumber),
      barcode: emptyToNull(barcode),
      status: status || 'IN_STOCK',
      currentWarehouseId: emptyToNull(currentWarehouseId),
      currentObjectId: emptyToNull(currentObjectId),
      responsibleUserId: emptyToNull(responsibleUserId),
      qrCodeUrl: '',
    },
    include: {
      currentWarehouse: { select: { id: true, name: true } },
      currentObject: { select: { id: true, name: true } },
      responsibleUser: { select: { id: true, name: true } },
    },
  })

  await prisma.equipment.update({
    where: { id: equipment.id },
    data: { qrCodeUrl: `/equipment/${equipment.id}` },
  })
  equipment.qrCodeUrl = `/equipment/${equipment.id}`

  writeAuditLog({
    userId: auth.userId,
    userName: auth.name,
    action: 'CREATE',
    entityType: 'Equipment',
    entityId: equipment.id,
    changes: { name: nameTrimmed },
  })

  return { equipment }
})
