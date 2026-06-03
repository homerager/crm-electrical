import { requirePermission } from '../../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'inventory.manage')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID обовʼязковий' })

  const session = await prisma.inventorySession.findUnique({ where: { id } })
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Сесію інвентаризації не знайдено' })
  }
  if (session.status === 'COMPLETED') {
    throw createError({ statusCode: 400, statusMessage: 'Сесія вже завершена' })
  }

  const body = await readBody(event)
  const { equipmentId, barcode } = body

  if (!equipmentId && !barcode) {
    throw createError({ statusCode: 400, statusMessage: 'Вкажіть equipmentId або barcode' })
  }

  let equipment
  if (equipmentId) {
    equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: { id: true, name: true, model: true, serialNumber: true, barcode: true, status: true, currentWarehouseId: true, currentObjectId: true },
    })
  } else {
    equipment = await prisma.equipment.findUnique({
      where: { barcode: barcode.trim() },
      select: { id: true, name: true, model: true, serialNumber: true, barcode: true, status: true, currentWarehouseId: true, currentObjectId: true },
    })
  }

  if (!equipment) {
    throw createError({ statusCode: 404, statusMessage: 'Обладнання не знайдено' })
  }

  const isExpectedHere = session.warehouseId
    ? equipment.currentWarehouseId === session.warehouseId
    : equipment.currentObjectId === session.objectId

  const existingItem = await prisma.inventorySessionItem.findUnique({
    where: { sessionId_equipmentId: { sessionId: id, equipmentId: equipment.id } },
  })

  let item
  let scanResult: 'found' | 'unexpected'

  if (existingItem) {
    if (existingItem.found) {
      return { item: existingItem, equipment, scanResult: 'already_scanned' }
    }
    item = await prisma.inventorySessionItem.update({
      where: { id: existingItem.id },
      data: { found: true, scannedAt: new Date() },
    })
    scanResult = 'found'
  } else {
    item = await prisma.inventorySessionItem.create({
      data: {
        sessionId: id,
        equipmentId: equipment.id,
        found: true,
        scannedAt: new Date(),
      },
    })
    scanResult = isExpectedHere ? 'found' : 'unexpected'
  }

  return { item, equipment, scanResult }
})
