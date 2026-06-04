import { requirePermission } from '../../../utils/authz'

/**
 * Дублює запис журналу робіт — створює точну копію (той самий працівник, дата,
 * локація, години, опис). Перевірку на конфлікт із розкладом навмисно пропущено:
 * дублювання — це свідома дія створити ще один запис на той самий день.
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401 })
  await requirePermission(event, 'schedules.manage')

  const id = getRouterParam(event, 'id')!
  const source = await prisma.timeLog.findUnique({ where: { id } })
  if (!source) throw createError({ statusCode: 404, statusMessage: 'Запис не знайдено' })

  const log = await prisma.timeLog.create({
    data: {
      taskId: source.taskId,
      objectId: source.objectId,
      warehouseId: source.warehouseId,
      userId: source.userId,
      createdById: auth.userId,
      hours: source.hours,
      description: source.description,
      date: source.date,
    },
    include: {
      user: { select: { id: true, name: true } },
      task: {
        select: {
          id: true,
          title: true,
          status: true,
          objectId: true,
          object: { select: { id: true, name: true } },
        },
      },
      object: { select: { id: true, name: true } },
      warehouse: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  return log
})
