import { isElevatedRole } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  if (!isElevatedRole(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID обовʼязковий' })

  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: {
      currentWarehouse: { select: { id: true, name: true } },
      currentObject: { select: { id: true, name: true } },
      responsibleUser: { select: { id: true, name: true } },
      movements: {
        include: {
          fromWarehouse: { select: { id: true, name: true } },
          fromObject: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
          toObject: { select: { id: true, name: true } },
          performedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      statusHistory: {
        include: {
          changedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!equipment) {
    throw createError({ statusCode: 404, statusMessage: 'Обладнання не знайдено' })
  }

  return { equipment }
})
