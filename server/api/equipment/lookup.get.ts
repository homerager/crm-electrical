import { requirePermission } from '../../utils/authz'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'equipment.view')

  const query = getQuery(event)
  const barcode = query.barcode as string | undefined

  if (!barcode || !barcode.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Параметр barcode обовʼязковий' })
  }

  const equipment = await prisma.equipment.findUnique({
    where: { barcode: barcode.trim() },
    include: {
      currentWarehouse: { select: { id: true, name: true } },
      currentObject: { select: { id: true, name: true } },
      responsibleUser: { select: { id: true, name: true } },
    },
  })

  if (!equipment) {
    throw createError({ statusCode: 404, statusMessage: 'Обладнання з таким штрих-кодом не знайдено' })
  }

  return { equipment }
})
