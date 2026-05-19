import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID обовʼязковий' })

  const session = await prisma.inventorySession.findUnique({
    where: { id },
    include: {
      warehouse: { select: { id: true, name: true } },
      object: { select: { id: true, name: true } },
      startedBy: { select: { id: true, name: true } },
      items: {
        include: {
          equipment: {
            select: {
              id: true,
              name: true,
              model: true,
              serialNumber: true,
              barcode: true,
              status: true,
            },
          },
        },
        orderBy: { scannedAt: { sort: 'desc', nulls: 'last' } },
      },
    },
  })

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Сесію інвентаризації не знайдено' })
  }

  return { session }
})
